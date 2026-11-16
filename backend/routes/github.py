from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from services.github_service import GitHubService

github_bp = Blueprint("github", __name__, url_prefix="/api/github")

def get_current_user():
    user_id = get_jwt_identity()
    if user_id:
        return db.session.get(User, user_id)
    return None

def is_admin(user):
    if not user:
        return False
    role = (user.role or "").strip().upper().replace(" ", "_")
    return role in ["ADMIN", "ADMINISTRATOR"]


@github_bp.route("/status", methods=["GET"])
def get_github_status():
    """Return genuine, verified GitHub connection status and repository metadata."""
    status_data = GitHubService.get_status()
    return jsonify(status_data), 200


@github_bp.route("/connect", methods=["POST"])
@jwt_required()
def connect_github():
    """Admin endpoint to securely configure and verify a GitHub Personal Access Token."""
    user = get_current_user()
    if not is_admin(user):
        return jsonify({"error": "Unauthorized: Only administrators can configure GitHub repository connections."}), 403

    data = request.get_json() or {}
    token = data.get("token")
    owner = data.get("owner", "krupabt")
    repo = data.get("repo", "BugFlow")
    webhook_secret = data.get("webhook_secret")

    if not token:
        return jsonify({"error": "GitHub Personal Access Token is required."}), 400

    result = GitHubService.connect(token=token, owner=owner, repo=repo, webhook_secret=webhook_secret)
    if not result.get("success"):
        return jsonify({"error": result.get("error")}), 400

    return jsonify(result), 200


@github_bp.route("/disconnect", methods=["POST"])
@jwt_required()
def disconnect_github():
    """Admin endpoint to disconnect GitHub repository integration."""
    user = get_current_user()
    if not is_admin(user):
        return jsonify({"error": "Unauthorized: Only administrators can manage repository connections."}), 403

    result = GitHubService.disconnect()
    return jsonify(result), 200


@github_bp.route("/commits", methods=["GET"])
def list_commits():
    """List real commits from the connected GitHub repository."""
    limit = request.args.get("limit", 30, type=int)
    branch = request.args.get("branch")

    result = GitHubService.get_commits(limit=limit, branch=branch)
    return jsonify(result), 200


@github_bp.route("/commits/<commit_sha>", methods=["GET"])
def get_commit_details(commit_sha):
    """Get real commit details and unified diff/patch from GitHub API."""
    result = GitHubService.get_commit_details(commit_sha)
    if "error" in result:
        return jsonify(result), 404
    return jsonify({"commit": result}), 200


@github_bp.route("/issues/<issue_id>/activity", methods=["GET"])
def get_issue_github_activity(issue_id):
    """Retrieve verified GitHub activity and linked commits for a specific issue."""
    result = GitHubService.get_issue_activity(issue_id)
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result), 200


@github_bp.route("/issues/<issue_id>/link", methods=["POST"])
@jwt_required()
def link_commit_to_issue(issue_id):
    """Link a real GitHub commit SHA to an issue."""
    data = request.get_json() or {}
    commit_sha = data.get("commit_sha") or data.get("commit_id")
    if not commit_sha:
        return jsonify({"error": "commit_sha is required."}), 400

    user = get_current_user()
    user_name = user.name if user else "Admin"

    result = GitHubService.link_issue_to_commit(issue_id=issue_id, commit_sha=commit_sha, user_name=user_name)
    if not result.get("success"):
        return jsonify(result), 400
    return jsonify(result), 200


@github_bp.route("/issues/<issue_id>/unlink/<commit_sha>", methods=["DELETE"])
@jwt_required()
def unlink_commit_from_issue(issue_id, commit_sha):
    """Unlink a commit from an issue."""
    result = GitHubService.unlink_issue_commit(issue_id=issue_id, commit_sha=commit_sha)
    if not result.get("success"):
        return jsonify(result), 404
    return jsonify(result), 200
