import os
import hmac
import hashlib
import base64
import re
import requests
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from extensions import db
from models.github_integration import GithubIntegration, IssueCommitLink
from models.issue import Issue
from models.webhook import WebhookDelivery

GITHUB_API_BASE = "https://api.github.com"

def get_fernet_cipher():
    """Derive a stable 32-byte Fernet key from application SECRET_KEY or GITHUB_ENCRYPTION_KEY."""
    secret = os.getenv("GITHUB_ENCRYPTION_KEY") or os.getenv("SECRET_KEY", "bugflow-secret-key-39f82d018b76")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)

def encrypt_token(token: str) -> str:
    if not token:
        return None
    cipher = get_fernet_cipher()
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return None
    try:
        cipher = get_fernet_cipher()
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception:
        return None


class GitHubService:
    @staticmethod
    def get_active_integration() -> GithubIntegration:
        """Get or initialize the GitHub integration record."""
        integration = GithubIntegration.query.first()
        if not integration:
            integration = GithubIntegration(
                owner=os.getenv("GITHUB_OWNER", "krupabt"),
                repo=os.getenv("GITHUB_REPO", "BugFlow"),
                status="NOT_CONNECTED"
            )
            db.session.add(integration)
            db.session.commit()
        return integration

    @staticmethod
    def get_credentials():
        """Retrieve token, owner, and repo from ENV or PostgreSQL."""
        # 1. Environment variables take precedence
        env_token = os.getenv("GITHUB_TOKEN")
        env_owner = os.getenv("GITHUB_OWNER")
        env_repo = os.getenv("GITHUB_REPO")
        env_secret = os.getenv("GITHUB_WEBHOOK_SECRET")

        integration = GithubIntegration.query.first()
        
        token = env_token or (decrypt_token(integration.encrypted_token) if integration else None)
        owner = env_owner or (integration.owner if integration else "krupabt") or "krupabt"
        repo = env_repo or (integration.repo if integration else "BugFlow") or "BugFlow"
        webhook_secret = env_secret or (integration.webhook_secret if integration else None)

        return {
            "token": token,
            "owner": owner,
            "repo": repo,
            "webhook_secret": webhook_secret,
            "is_from_env": bool(env_token)
        }

    @staticmethod
    def get_headers(token=None):
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "BugFlow-Defect-Tracker/1.0"
        }
        creds = GitHubService.get_credentials()
        active_token = token or creds.get("token")
        if active_token:
            headers["Authorization"] = f"Bearer {active_token}"
        return headers

    @classmethod
    def test_token(cls, token: str, owner: str = None, repo: str = None):
        """Test a GitHub token against the GitHub API to verify credentials and repo access."""
        if not token:
            return {"valid": False, "error": "No token provided"}

        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "BugFlow-Defect-Tracker/1.0",
            "Authorization": f"Bearer {token}"
        }

        try:
            # 1. Verify user identity
            user_res = requests.get(f"{GITHUB_API_BASE}/user", headers=headers, timeout=10)
            if user_res.status_code == 401:
                return {"valid": False, "error": "Bad credentials: Token is invalid or expired."}
            if user_res.status_code == 403:
                return {"valid": False, "error": "GitHub API access forbidden: Rate limit exceeded or insufficient scope."}
            if user_res.status_code != 200:
                return {"valid": False, "error": f"GitHub user verification returned HTTP {user_res.status_code}"}

            user_data = user_res.json()

            # 2. Verify repository access if owner and repo are provided
            repo_data = None
            if owner and repo:
                repo_res = requests.get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}", headers=headers, timeout=10)
                if repo_res.status_code == 404:
                    return {
                        "valid": True,
                        "repo_accessible": False,
                        "user": user_data,
                        "error": f"Repository '{owner}/{repo}' not found or token lacks access."
                    }
                elif repo_res.status_code == 200:
                    repo_data = repo_res.json()

            return {
                "valid": True,
                "repo_accessible": True if repo_data else False,
                "user": user_data,
                "repo": repo_data
            }
        except requests.RequestException as e:
            return {"valid": False, "error": f"Network error connecting to GitHub API: {str(e)}"}

    @classmethod
    def get_status(cls):
        """Get the real, verified connection status to GitHub."""
        creds = cls.get_credentials()
        integration = cls.get_active_integration()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {
                "status": "Not Connected",
                "connected": False,
                "owner": owner,
                "repo": repo,
                "repository_name": f"{owner}/{repo}",
                "repository_url": f"https://github.com/{owner}/{repo}",
                "authenticated_user": None,
                "default_branch": integration.default_branch or "main",
                "total_commits": 0,
                "linked_issues_count": 0,
                "error": "No GitHub Personal Access Token configured.",
                "setup_instructions": {
                    "step1": "Create a GitHub Personal Access Token (classic or fine-grained) at https://github.com/settings/tokens",
                    "step2": "Grant 'repo' (Full control of private repositories) and 'workflow' (Update GitHub Action workflows) permissions.",
                    "step3": "Set GITHUB_TOKEN in backend/.env OR click 'Connect Repository' in the BugFlow Admin UI."
                }
            }

        # Verify token live
        test_result = cls.test_token(token, owner, repo)
        if not test_result.get("valid"):
            integration.status = "AUTH_FAILED"
            integration.last_error = test_result.get("error")
            db.session.commit()
            return {
                "status": "Authentication Failed",
                "connected": False,
                "owner": owner,
                "repo": repo,
                "repository_name": f"{owner}/{repo}",
                "repository_url": f"https://github.com/{owner}/{repo}",
                "authenticated_user": None,
                "error": test_result.get("error"),
                "setup_instructions": {
                    "step1": "Verify that your GITHUB_TOKEN has not expired.",
                    "step2": "Check that the token has 'repo' and 'workflow' scopes enabled.",
                    "step3": "Update the token in backend/.env or through the Connect Repository modal."
                }
            }

        user_info = test_result.get("user") or {}
        repo_info = test_result.get("repo") or {}

        # Update integration in DB
        integration.status = "CONNECTED"
        integration.authenticated_user = user_info.get("login")
        integration.user_avatar_url = user_info.get("avatar_url")
        integration.user_html_url = user_info.get("html_url")
        integration.default_branch = repo_info.get("default_branch") or integration.default_branch or "main"
        integration.repo_url = repo_info.get("html_url") or f"https://github.com/{owner}/{repo}"
        integration.last_synced_at = datetime.now(timezone.utc)
        integration.last_error = None
        db.session.commit()

        # Count linked issues in database
        linked_issues_count = db.session.query(IssueCommitLink.issue_id).distinct().count()

        return {
            "status": "Connected",
            "connected": True,
            "owner": owner,
            "repo": repo,
            "repository_name": f"{owner}/{repo}",
            "repository_url": integration.repo_url,
            "default_branch": integration.default_branch,
            "authenticated_user": integration.authenticated_user,
            "user_avatar_url": integration.user_avatar_url,
            "user_html_url": integration.user_html_url,
            "is_private": repo_info.get("private", False),
            "open_issues_count": repo_info.get("open_issues_count", 0),
            "stars_count": repo_info.get("stargazers_count", 0),
            "linked_issues_count": linked_issues_count,
            "last_synced_at": integration.last_synced_at.isoformat()
        }

    @classmethod
    def connect(cls, token: str, owner: str = "krupabt", repo: str = "BugFlow", webhook_secret: str = None):
        """Connect repository using provided token."""
        test_result = cls.test_token(token, owner, repo)
        if not test_result.get("valid"):
            return {"success": False, "error": test_result.get("error")}

        integration = cls.get_active_integration()
        integration.owner = owner
        integration.repo = repo
        integration.encrypted_token = encrypt_token(token)
        if webhook_secret:
            integration.webhook_secret = webhook_secret
        integration.status = "CONNECTED"
        
        user_info = test_result.get("user") or {}
        repo_info = test_result.get("repo") or {}
        integration.authenticated_user = user_info.get("login")
        integration.user_avatar_url = user_info.get("avatar_url")
        integration.user_html_url = user_info.get("html_url")
        integration.default_branch = repo_info.get("default_branch") or "main"
        integration.repo_url = repo_info.get("html_url") or f"https://github.com/{owner}/{repo}"
        integration.last_synced_at = datetime.now(timezone.utc)
        integration.last_error = None

        db.session.commit()

        return {
            "success": True,
            "message": f"Successfully connected to GitHub repository {owner}/{repo}.",
            "integration": integration.to_dict()
        }

    @classmethod
    def disconnect(cls):
        """Disconnect GitHub repository integration."""
        integration = cls.get_active_integration()
        integration.encrypted_token = None
        integration.status = "NOT_CONNECTED"
        integration.authenticated_user = None
        integration.last_error = None
        db.session.commit()
        return {"success": True, "message": "GitHub repository integration disconnected."}

    @classmethod
    def get_commits(cls, limit: int = 30, branch: str = None):
        """Retrieve real commits from GitHub API."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {"connected": False, "commits": [], "error": "GitHub is not connected. Configure GITHUB_TOKEN."}

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
        params = {"per_page": limit}
        if branch:
            params["sha"] = branch

        try:
            res = requests.get(url, headers=cls.get_headers(), params=params, timeout=12)
            if res.status_code == 401:
                return {"connected": False, "commits": [], "error": "GitHub token unauthorized."}
            if res.status_code == 404:
                return {"connected": False, "commits": [], "error": f"Repository '{owner}/{repo}' not found."}
            if res.status_code != 200:
                return {"connected": False, "commits": [], "error": f"GitHub API error: {res.status_code}"}

            commits_raw = res.json()
            formatted = []
            for item in commits_raw:
                sha = item.get("sha", "")
                commit_info = item.get("commit", {})
                author_info = item.get("author") or {}
                committer_info = commit_info.get("author") or {}
                
                # Check if commit message references any issue (e.g. BUG-00086)
                msg = commit_info.get("message", "")
                issue_match = re.search(r'\b(BUG-\d{5})\b', msg, re.IGNORECASE)
                referenced_issue = issue_match.group(1).upper() if issue_match else None

                formatted.append({
                    "commit_id": sha,
                    "commit_sha": sha,
                    "short_sha": sha[:7],
                    "commit_message": msg,
                    "author_name": committer_info.get("name") or author_info.get("login") or "Developer",
                    "author_email": committer_info.get("email"),
                    "author_avatar": author_info.get("avatar_url"),
                    "committed_at": committer_info.get("date"),
                    "view_url": item.get("html_url") or f"https://github.com/{owner}/{repo}/commit/{sha}",
                    "issue_id": referenced_issue,
                    "files_changed_count": len(item.get("files", [])) if "files" in item else None,
                    "status": "Verified"
                })

            return {"connected": True, "commits": formatted, "count": len(formatted)}
        except requests.RequestException as e:
            return {"connected": False, "commits": [], "error": f"Failed to connect to GitHub: {str(e)}"}

    @classmethod
    def get_branches(cls):
        """Retrieve real repository branches from GitHub API."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {"connected": False, "branches": [{"name": "main"}], "error": "GitHub is not connected."}

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/branches"
        try:
            res = requests.get(url, headers=cls.get_headers(), timeout=12)
            if res.status_code != 200:
                return {"connected": False, "branches": [{"name": "main"}], "error": f"Failed to fetch branches (HTTP {res.status_code})"}
            branches_data = res.json()
            formatted = []
            for b in branches_data:
                formatted.append({
                    "name": b.get("name"),
                    "commit_sha": b.get("commit", {}).get("sha"),
                    "short_sha": (b.get("commit", {}).get("sha") or "")[:7],
                    "protected": b.get("protected", False)
                })
            return {"connected": True, "branches": formatted, "count": len(formatted)}
        except requests.RequestException as e:
            return {"connected": False, "branches": [{"name": "main"}], "error": str(e)}

    @classmethod
    def get_commit_details(cls, commit_sha: str):
        """Retrieve real commit details and unified diff from GitHub API."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {"error": "GitHub is not connected."}

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{commit_sha}"
        
        try:
            # 1. Fetch JSON details
            res = requests.get(url, headers=cls.get_headers(), timeout=12)
            if res.status_code != 200:
                return {"error": f"Commit '{commit_sha}' not found on GitHub."}

            data = res.json()
            commit_info = data.get("commit", {})
            author_info = data.get("author") or {}
            committer_info = commit_info.get("author") or {}
            stats = data.get("stats") or {}
            files = data.get("files", [])

            # 2. Fetch unified diff patch
            diff_headers = cls.get_headers()
            diff_headers["Accept"] = "application/vnd.github.v3.diff"
            diff_res = requests.get(url, headers=diff_headers, timeout=12)
            diff_content = diff_res.text if diff_res.status_code == 200 else ""

            # Build files summary
            files_summary = []
            for f in files:
                files_summary.append({
                    "filename": f.get("filename"),
                    "status": f.get("status"),
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "patch": f.get("patch")
                })

            return {
                "commit_id": data.get("sha"),
                "short_sha": data.get("sha", "")[:7],
                "commit_message": commit_info.get("message"),
                "author_name": committer_info.get("name") or author_info.get("login"),
                "author_email": committer_info.get("email"),
                "author_avatar": author_info.get("avatar_url"),
                "committed_at": committer_info.get("date"),
                "view_url": data.get("html_url"),
                "files_changed_count": len(files),
                "additions": stats.get("additions", 0),
                "deletions": stats.get("deletions", 0),
                "diff_content": diff_content,
                "files_summary": files_summary
            }
        except requests.RequestException as e:
            return {"error": f"Failed to retrieve commit details: {str(e)}"}

    @classmethod
    def get_issue_activity(cls, issue_id: str):
        """Get real GitHub activity linked to an issue."""
        issue = db.session.get(Issue, issue_id)
        if not issue:
            return {"error": f"Issue '{issue_id}' not found"}

        creds = cls.get_credentials()
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        status_info = cls.get_status()

        # 1. Check explicit links in database
        explicit_links = IssueCommitLink.query.filter_by(issue_id=issue_id).order_by(IssueCommitLink.created_at.desc()).all()
        linked_commits = [link.to_dict() for link in explicit_links]

        # 2. If connected to GitHub, search commits for references to this issue
        if status_info.get("connected"):
            commits_res = cls.get_commits(limit=50)
            if commits_res.get("connected"):
                pattern = re.compile(rf'\b{re.escape(issue_id)}\b', re.IGNORECASE)
                for c in commits_res.get("commits", []):
                    if pattern.search(c.get("commit_message", "")):
                        # If not already in linked_commits, add it
                        if not any(lk.get("commit_sha") == c.get("commit_sha") for lk in linked_commits):
                            linked_commits.append(c)

        return {
            "issue_id": issue.id,
            "issue_title": issue.title,
            "repository_name": f"{owner}/{repo}",
            "repository_url": f"https://github.com/{owner}/{repo}",
            "is_connected": status_info.get("connected", False),
            "status": "Linked" if linked_commits else ("Connected" if status_info.get("connected") else "Not Connected"),
            "commits_count": len(linked_commits),
            "commits": linked_commits,
            "primary_commit": linked_commits[0] if linked_commits else None,
            "setup_instructions": status_info.get("setup_instructions") if not status_info.get("connected") else None
        }

    @classmethod
    def link_issue_to_commit(cls, issue_id: str, commit_sha: str, user_name: str = "Admin"):
        """Explicitly link an issue to a commit."""
        issue = db.session.get(Issue, issue_id)
        if not issue:
            return {"success": False, "error": f"Issue '{issue_id}' not found."}

        # Check if already linked
        existing = IssueCommitLink.query.filter_by(issue_id=issue_id, commit_sha=commit_sha).first()
        if existing:
            return {"success": True, "message": "Commit is already linked to this issue.", "link": existing.to_dict()}

        # Get commit details from GitHub
        details = cls.get_commit_details(commit_sha)
        if "error" in details:
            # Fallback to minimal details if GitHub query fails
            short_sha = commit_sha[:7]
            msg = f"Commit {short_sha} linked to {issue_id}"
            author = user_name
            html_url = f"https://github.com/krupabt/BugFlow/commit/{commit_sha}"
            additions = 0
            deletions = 0
            files_count = 1
            committed_at = datetime.now(timezone.utc)
        else:
            short_sha = details.get("short_sha")
            msg = details.get("commit_message")
            author = details.get("author_name")
            html_url = details.get("view_url")
            additions = details.get("additions", 0)
            deletions = details.get("deletions", 0)
            files_count = details.get("files_changed_count", 0)
            try:
                committed_at = datetime.fromisoformat(details.get("committed_at").replace("Z", "+00:00"))
            except Exception:
                committed_at = datetime.now(timezone.utc)

        link = IssueCommitLink(
            issue_id=issue_id,
            commit_sha=commit_sha,
            short_sha=short_sha,
            commit_message=msg,
            author_name=author,
            html_url=html_url,
            additions=additions,
            deletions=deletions,
            files_changed_count=files_count,
            committed_at=committed_at,
            linked_by=user_name,
            linked_method="MANUAL"
        )
        db.session.add(link)
        db.session.commit()

        return {"success": True, "message": f"Commit {short_sha} successfully linked to issue {issue_id}.", "link": link.to_dict()}

    @classmethod
    def unlink_issue_commit(cls, issue_id: str, commit_sha: str):
        """Unlink an issue from a commit."""
        link = IssueCommitLink.query.filter_by(issue_id=issue_id, commit_sha=commit_sha).first()
        if not link:
            return {"success": False, "error": "Link not found."}
        db.session.delete(link)
        db.session.commit()
        return {"success": True, "message": f"Commit {commit_sha[:7]} unlinked from issue {issue_id}."}

    # =========================================================================
    # GITHUB ACTIONS CI/CD METHODS
    # =========================================================================

    @classmethod
    def get_actions_workflows(cls):
        """Retrieve real GitHub Actions workflows."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {"connected": False, "workflows": [], "error": "GitHub is not connected."}

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/actions/workflows"
        try:
            res = requests.get(url, headers=cls.get_headers(), timeout=12)
            if res.status_code != 200:
                return {"connected": False, "workflows": [], "error": f"Failed to fetch workflows (HTTP {res.status_code})"}
            data = res.json()
            return {"connected": True, "workflows": data.get("workflows", []), "total_count": data.get("total_count", 0)}
        except requests.RequestException as e:
            return {"connected": False, "workflows": [], "error": str(e)}

    @classmethod
    def get_actions_runs(cls, limit: int = 15, branch: str = None):
        """Retrieve real workflow runs from GitHub Actions."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {
                "connected": False,
                "runs": [],
                "error": "GitHub is not connected. Configure GITHUB_TOKEN to view live workflow runs.",
                "setup_instructions": {
                    "step1": "Ensure GITHUB_TOKEN has 'workflow' permissions.",
                    "step2": "Check that GitHub Actions workflows are enabled in https://github.com/krupabt/BugFlow/actions"
                }
            }

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/actions/runs"
        params = {"per_page": limit}
        if branch:
            params["branch"] = branch

        try:
            res = requests.get(url, headers=cls.get_headers(), params=params, timeout=12)
            if res.status_code != 200:
                return {"connected": False, "runs": [], "error": f"GitHub Actions API returned HTTP {res.status_code}"}

            data = res.json()
            raw_runs = data.get("workflow_runs", [])
            formatted = []

            for r in raw_runs:
                # Compute duration in seconds
                start = r.get("run_started_at") or r.get("created_at")
                end = r.get("updated_at")
                duration_sec = 0
                if start and end:
                    try:
                        d1 = datetime.fromisoformat(start.replace("Z", "+00:00"))
                        d2 = datetime.fromisoformat(end.replace("Z", "+00:00"))
                        duration_sec = int((d2 - d1).total_seconds())
                    except Exception:
                        duration_sec = 0

                dur_disp = f"{duration_sec // 60}m {duration_sec % 60}s" if duration_sec > 0 else "—"

                # Check commit message for referenced issue
                head_commit = r.get("head_commit") or {}
                commit_msg = head_commit.get("message", "")
                issue_match = re.search(r'\b(BUG-\d{5})\b', commit_msg, re.IGNORECASE)
                rel_issue = issue_match.group(1).upper() if issue_match else None

                # Status mapping
                status_raw = r.get("status") # queued, in_progress, completed
                conclusion_raw = r.get("conclusion") # success, failure, neutral, cancelled, skipped, timed_out
                
                if status_raw == "completed":
                    final_status = "SUCCESS" if conclusion_raw == "success" else ("FAILED" if conclusion_raw in ["failure", "timed_out"] else (conclusion_raw.upper() if conclusion_raw else "COMPLETED"))
                elif status_raw in ["in_progress", "queued"]:
                    final_status = "RUNNING"
                else:
                    final_status = (status_raw or "UNKNOWN").upper()

                formatted.append({
                    "id": r.get("id"),
                    "run_id": f"#{r.get('run_number', r.get('id'))}",
                    "workflow_id": r.get("workflow_id"),
                    "workflow_name": r.get("name", "BugFlow CI/CD Pipeline"),
                    "branch": r.get("head_branch", "main"),
                    "commit_id": r.get("head_sha"),
                    "short_sha": (r.get("head_sha") or "")[:7],
                    "commit_message": commit_msg or "Commit push to repository",
                    "commit_author": (head_commit.get("author") or {}).get("name") or "Developer",
                    "status": final_status,
                    "github_status": status_raw,
                    "github_conclusion": conclusion_raw,
                    "event": r.get("event"),
                    "html_url": r.get("html_url"),
                    "duration_seconds": duration_sec,
                    "duration_display": dur_disp,
                    "started_at": start,
                    "completed_at": end if status_raw == "completed" else None,
                    "related_issue_id": rel_issue,
                    "related_issue_update": f"{rel_issue} automated verification updated" if rel_issue else None,
                    "triggered_by": (r.get("actor") or {}).get("login") or "GitHub Actions"
                })

            return {"connected": True, "runs": formatted, "count": len(formatted), "total_count": data.get("total_count", 0)}
        except requests.RequestException as e:
            return {"connected": False, "runs": [], "error": f"Failed to retrieve workflow runs: {str(e)}"}

    @classmethod
    def get_run_jobs(cls, run_id: int):
        """Retrieve real jobs for a specific workflow run from GitHub Actions."""
        creds = cls.get_credentials()
        token = creds.get("token")
        owner = creds.get("owner", "krupabt")
        repo = creds.get("repo", "BugFlow")

        if not token:
            return {"connected": False, "jobs": [], "error": "GitHub is not connected."}

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
        try:
            res = requests.get(url, headers=cls.get_headers(), timeout=12)
            if res.status_code != 200:
                return {"connected": False, "jobs": [], "error": f"GitHub Jobs API returned HTTP {res.status_code}"}

            data = res.json()
            jobs = data.get("jobs", [])
            formatted = []
            for j in jobs:
                formatted.append({
                    "id": j.get("id"),
                    "name": j.get("name"),
                    "status": (j.get("status") or "").upper(),
                    "conclusion": (j.get("conclusion") or "").upper() if j.get("conclusion") else None,
                    "started_at": j.get("started_at"),
                    "completed_at": j.get("completed_at"),
                    "steps": j.get("steps", [])
                })
            return {"connected": True, "jobs": formatted, "count": len(formatted)}
        except requests.RequestException as e:
            return {"connected": False, "jobs": [], "error": str(e)}

    # =========================================================================
    # WEBHOOK SIGNATURE & EVENT VERIFICATION
    # =========================================================================

    @classmethod
    def verify_webhook_signature(cls, payload_bytes: bytes, signature_header: str, secret: str = None) -> bool:
        """Verify HMAC-SHA256 signature from GitHub X-Hub-Signature-256 header."""
        if not signature_header or not signature_header.startswith("sha256="):
            return False

        expected_secret = secret or cls.get_credentials().get("webhook_secret") or os.getenv("GITHUB_WEBHOOK_SECRET")
        if not expected_secret:
            # If no webhook secret configured, verification cannot succeed
            return False

        hash_object = hmac.new(expected_secret.encode('utf-8'), msg=payload_bytes, digestmod=hashlib.sha256)
        expected_signature = f"sha256={hash_object.hexdigest()}"

        return hmac.compare_digest(expected_signature, signature_header)

    @classmethod
    def process_webhook_event(cls, delivery_id: str, event_type: str, payload: dict) -> dict:
        """Process incoming GitHub webhook with idempotency check."""
        if not delivery_id:
            return {"status": "error", "message": "Missing X-GitHub-Delivery header."}

        # Check for duplicate delivery
        existing = WebhookDelivery.query.filter_by(delivery_id=delivery_id).first()
        if existing:
            return {"status": "duplicate", "message": f"Webhook delivery {delivery_id} was already processed."}

        delivery = WebhookDelivery(
            delivery_id=delivery_id,
            event_type=event_type,
            action=payload.get("action"),
            repository=payload.get("repository", {}).get("full_name"),
            sender=payload.get("sender", {}).get("login"),
            status="PROCESSED",
            payload_summary={
                "action": payload.get("action"),
                "ref": payload.get("ref"),
                "commit_count": len(payload.get("commits", [])) if "commits" in payload else None,
                "workflow_name": payload.get("workflow", {}).get("name") if "workflow" in payload else None
            }
        )

        # Process specific events
        if event_type == "push":
            commits = payload.get("commits", [])
            for c in commits:
                msg = c.get("message", "")
                issue_match = re.search(r'\b(BUG-\d{5})\b', msg, re.IGNORECASE)
                if issue_match:
                    issue_id = issue_match.group(1).upper()
                    # Link if issue exists
                    issue = db.session.get(Issue, issue_id)
                    if issue:
                        existing_link = IssueCommitLink.query.filter_by(issue_id=issue_id, commit_sha=c.get("id")).first()
                        if not existing_link:
                            link = IssueCommitLink(
                                issue_id=issue_id,
                                commit_sha=c.get("id"),
                                short_sha=c.get("id")[:7],
                                commit_message=msg,
                                author_name=c.get("author", {}).get("name"),
                                author_email=c.get("author", {}).get("email"),
                                html_url=c.get("url"),
                                linked_by="GitHub Webhook",
                                linked_method="WEBHOOK"
                            )
                            db.session.add(link)

        db.session.add(delivery)
        db.session.commit()

        return {"status": "success", "message": f"Webhook event '{event_type}' processed successfully."}
