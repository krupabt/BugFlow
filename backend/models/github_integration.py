from datetime import datetime, timezone
from extensions import db

class GithubIntegration(db.Model):
    __tablename__ = "github_integrations"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    owner = db.Column(db.String(100), nullable=False, default="krupabt")
    repo = db.Column(db.String(100), nullable=False, default="BugFlow")
    encrypted_token = db.Column(db.Text, nullable=True) # AES/Fernet encrypted token, NEVER plaintext
    webhook_secret = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), nullable=False, default="NOT_CONNECTED") # CONNECTED, NOT_CONNECTED, AUTH_FAILED
    authenticated_user = db.Column(db.String(100), nullable=True)
    user_avatar_url = db.Column(db.String(255), nullable=True)
    user_html_url = db.Column(db.String(255), nullable=True)
    repo_url = db.Column(db.String(255), nullable=True, default="https://github.com/krupabt/BugFlow")
    default_branch = db.Column(db.String(50), nullable=False, default="main")
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_synced_at = db.Column(db.DateTime, nullable=True)
    last_error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self, include_sensitive=False):
        return {
            "id": self.id,
            "owner": self.owner,
            "repo": self.repo,
            "repository_name": f"{self.owner}/{self.repo}",
            "repository_url": self.repo_url or f"https://github.com/{self.owner}/{self.repo}",
            "status": self.status,
            "is_connected": self.status == "CONNECTED",
            "authenticated_user": self.authenticated_user,
            "user_avatar_url": self.user_avatar_url,
            "user_html_url": self.user_html_url,
            "default_branch": self.default_branch,
            "has_token_configured": bool(self.encrypted_token),
            "has_webhook_secret": bool(self.webhook_secret),
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
            "last_error": self.last_error,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class IssueCommitLink(db.Model):
    __tablename__ = "issue_commit_links"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_sha = db.Column(db.String(100), nullable=False, index=True)
    short_sha = db.Column(db.String(20), nullable=False)
    commit_message = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(100), nullable=True)
    author_email = db.Column(db.String(150), nullable=True)
    author_avatar_url = db.Column(db.String(255), nullable=True)
    committed_at = db.Column(db.DateTime, nullable=True)
    html_url = db.Column(db.String(255), nullable=True)
    files_changed_count = db.Column(db.Integer, default=0, nullable=False)
    additions = db.Column(db.Integer, default=0, nullable=False)
    deletions = db.Column(db.Integer, default=0, nullable=False)
    linked_by = db.Column(db.String(100), nullable=True)
    linked_method = db.Column(db.String(50), default="MANUAL", nullable=False) # MANUAL, COMMIT_MESSAGE, WEBHOOK
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    issue = db.relationship("Issue", foreign_keys=[issue_id], backref=db.backref("commit_links", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": self.issue_id,
            "commit_id": self.commit_sha,
            "commit_sha": self.commit_sha,
            "short_sha": self.short_sha or self.commit_sha[:7],
            "commit_message": self.commit_message,
            "author_name": self.author_name or "Unknown",
            "author_email": self.author_email,
            "author_avatar": self.author_avatar_url,
            "committed_at": self.committed_at.isoformat() if self.committed_at else None,
            "view_url": self.html_url or f"https://github.com/krupabt/BugFlow/commit/{self.commit_sha}",
            "html_url": self.html_url,
            "files_changed_count": self.files_changed_count,
            "additions": self.additions,
            "deletions": self.deletions,
            "linked_by": self.linked_by,
            "linked_method": self.linked_method,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
