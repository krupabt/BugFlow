from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User
from app.models.comment import IssueComment
from app.models.history import IssueStatusHistory

issues_bp = Blueprint("issues", __name__, url_prefix="/api/issues")

@issues_bp.route("", methods=["GET"])
def get_issues():
    q = request.args.get("q", "").strip()
    status = request.args.get("status")
    severity = request.args.get("severity")
    priority = request.args.get("priority")
    project_id = request.args.get("project_id", type=int)
    assignee_id = request.args.get("assignee_id", type=int)
    
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    sort_by = request.args.get("sort_by", "created_at")
    sort_dir = request.args.get("sort_dir", "desc")
    
    query = Issue.query
    
    # Text search
    if q:
        query = query.filter(
            (Issue.title.ilike(f"%{q}%")) |
            (Issue.description.ilike(f"%{q}%"))
        )
        
    # Filters
    if status and status != "All":
        query = query.filter(Issue.status == status)
    if severity and severity != "All":
        query = query.filter(Issue.severity == severity)
    if priority and priority != "All":
        query = query.filter(Issue.priority == priority)
    if project_id:
        query = query.filter(Issue.project_id == project_id)
    if assignee_id:
        query = query.filter(Issue.assigned_to == assignee_id)
        
    # Sorting
    sort_column = getattr(Issue, sort_by, Issue.created_at)
    if sort_dir.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
        
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        "issues": [i.to_dict() for i in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": pagination.per_page,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev
    }), 200

@issues_bp.route("/<int:issue_id>", methods=["GET"])
def get_issue(issue_id):
    issue = Issue.query.get(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
    return jsonify(issue.to_dict(include_details=True)), 200

@issues_bp.route("", methods=["POST"])
@jwt_required(optional=True)
def create_issue():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    project_id = data.get("project_id")
    severity = data.get("severity", "Medium")
    priority = data.get("priority", "Medium")
    assignee_id = data.get("assignee_id")
    
    if not title:
        return jsonify({"error": "Issue title is required"}), 400
    if not project_id:
        return jsonify({"error": "Project is required"}), 400
        
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Specified project does not exist"}), 404
        
    identity = get_jwt_identity()
    reporter_id = int(identity) if identity else data.get("reporter_id")
    
    issue = Issue(
        title=title,
        description=description,
        project_id=project.id,
        reported_by=reporter_id,
        assigned_to=assignee_id,
        severity=severity,
        priority=priority,
        status="Open"
    )
    db.session.add(issue)
    db.session.flush()
    
    # Record initial status creation history
    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=reporter_id,
        old_status=None,
        new_status="Open",
        comment="Issue reported and opened"
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "message": "Issue created successfully",
        "issue": issue.to_dict(include_details=True)
    }), 201

@issues_bp.route("/<int:issue_id>", methods=["PUT"])
@jwt_required(optional=True)
def update_issue(issue_id):
    issue = Issue.query.get(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    data = request.get_json(silent=True) or {}
    if "title" in data:
        issue.title = data["title"].strip()
    if "description" in data:
        issue.description = data["description"].strip()
    if "severity" in data:
        issue.severity = data["severity"]
    if "priority" in data:
        issue.priority = data["priority"]
    if "assignee_id" in data:
        issue.assigned_to = data["assignee_id"]
        
    db.session.commit()
    return jsonify({
        "message": "Issue updated successfully",
        "issue": issue.to_dict(include_details=True)
    }), 200

@issues_bp.route("/<int:issue_id>/status", methods=["PATCH"])
@jwt_required(optional=True)
def update_status(issue_id):
    issue = Issue.query.get(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    comment_text = data.get("comment", "")
    
    allowed = ["Open", "In Progress", "Resolved", "Closed"]
    if new_status not in allowed:
        return jsonify({"error": f"Invalid status. Must be one of {allowed}"}), 400
        
    old_status = issue.status
    issue.status = new_status
    issue.updated_at = datetime.now(timezone.utc)
        
    identity = get_jwt_identity()
    user_id = int(identity) if identity else None
    
    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user_id,
        old_status=old_status,
        new_status=new_status,
        comment=comment_text or f"Status changed from {old_status} to {new_status}"
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "message": f"Status updated from {old_status} to {new_status}",
        "issue": issue.to_dict(include_details=True)
    }), 200

@issues_bp.route("/<int:issue_id>/comments", methods=["POST"])
@jwt_required(optional=True)
def add_comment(issue_id):
    issue = Issue.query.get(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Comment text cannot be empty"}), 400
        
    identity = get_jwt_identity()
    user_id = int(identity) if identity else data.get("user_id")
    
    if not user_id:
        u = User.query.first()
        user_id = u.id if u else None
        
    if not user_id:
        return jsonify({"error": "User identity required to post comments"}), 400
        
    comment = IssueComment(
        issue_id=issue.id,
        user_id=user_id,
        content=content
    )
    db.session.add(comment)
    db.session.commit()
    
    return jsonify({
        "message": "Comment posted successfully",
        "comment": comment.to_dict()
    }), 201

@issues_bp.route("/<int:issue_id>", methods=["DELETE"])
@jwt_required(optional=True)
def delete_issue(issue_id):
    issue = Issue.query.get(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    db.session.delete(issue)
    db.session.commit()
    return jsonify({"message": f"Issue deleted successfully"}), 200
