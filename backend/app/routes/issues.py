from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from app.extensions import db
from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User
from app.models.comment import IssueComment
from app.models.history import IssueStatusHistory

issues_bp = Blueprint("issues", __name__, url_prefix="/api/issues")

WORKFLOW_STATES = ["Open", "In Progress", "Testing", "Resolved", "Closed"]

@issues_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_issues():
    q = request.args.get("q", "").strip()
    status = request.args.get("status")
    severity = request.args.get("severity")
    priority = request.args.get("priority")
    issue_type = request.args.get("issue_type")
    project_id = request.args.get("project_id")
    assignee_id = request.args.get("assignee_id") or request.args.get("assigned_to")
    reporter_id = request.args.get("reporter_id") or request.args.get("created_by")
    sprint_id = request.args.get("sprint_id")
    
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    sort_by = request.args.get("sort_by", "id")
    sort_dir = request.args.get("sort_dir", "desc")
    
    query = Issue.query
    
    # Text search
    if q:
        query = query.filter(
            (Issue.title.ilike(f"%{q}%")) |
            (Issue.description.ilike(f"%{q}%")) |
            (Issue.id.ilike(f"%{q}%")) |
            (Issue.component.ilike(f"%{q}%"))
        )
        
    # Filters
    if status and status != "All":
        query = query.filter(Issue.status == status)
    if severity and severity != "All":
        query = query.filter(Issue.severity == severity)
    if priority and priority != "All":
        query = query.filter(Issue.priority == priority)
    if issue_type and issue_type != "All":
        query = query.filter(Issue.issue_type == issue_type)
    if project_id and project_id != "All":
        query = query.filter(Issue.project_id == project_id)
    if assignee_id and assignee_id != "All":
        if assignee_id == "unassigned":
            query = query.filter(Issue.assigned_to.is_(None))
        else:
            query = query.filter(Issue.assigned_to == assignee_id)
    if reporter_id and reporter_id != "All":
        query = query.filter((Issue.reported_by == reporter_id) | (Issue.created_by == reporter_id))
    if sprint_id and sprint_id != "All":
        query = query.filter(Issue.sprint_id == sprint_id)
        
    # Sorting
    sort_col = getattr(Issue, sort_by, Issue.id)
    if sort_dir.lower() == "asc":
        query = query.order_by(sort_col.asc().nullslast())
    else:
        query = query.order_by(sort_col.desc().nullslast())
        
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

@issues_bp.route("/<string:issue_id>", methods=["GET"])
@jwt_required(optional=True)
def get_issue(issue_id):
    issue = db.session.get(Issue, issue_id)
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
    issue_type = data.get("issue_type", "Bug")
    severity = data.get("severity", "Medium")
    priority = data.get("priority", "P2")
    assigned_to = data.get("assigned_to") or data.get("assignee_id")
    component = data.get("component")
    environment = data.get("environment")
    steps_to_reproduce = data.get("steps_to_reproduce") or data.get("repro_steps")
    expected_result = data.get("expected_result")
    actual_result = data.get("actual_result")
    business_impact = data.get("business_impact")
    sprint_id = data.get("sprint_id")
    
    if not title:
        return jsonify({"error": "Issue title is required"}), 400
    if not project_id:
        return jsonify({"error": "Project selection is required"}), 400
        
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Specified project does not exist"}), 404
        
    identity = get_jwt_identity()
    user = db.session.get(User, str(identity)) if identity else None
    creator_id = user.id if user else (data.get("created_by") or data.get("reporter_id"))

    # Generate unique Issue ID: BUG-xxxxx
    total_count = Issue.query.count()
    new_id = f"BUG-{total_count + 1:05d}"
    while db.session.get(Issue, new_id):
        total_count += 1
        new_id = f"BUG-{total_count + 1:05d}"

    today = datetime.now().date()
    issue = Issue(
        id=new_id,
        title=title,
        description=description,
        issue_type=issue_type,
        severity=severity,
        priority=priority,
        status="Open",
        project_id=project.id,
        reported_by=creator_id,
        created_by=creator_id,
        assigned_to=assigned_to,
        component=component,
        environment=environment,
        steps_to_reproduce=steps_to_reproduce,
        expected_result=expected_result,
        actual_result=actual_result,
        business_impact=business_impact,
        sprint_id=sprint_id,
        created_date=today,
        updated_date=today,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.session.add(issue)
    db.session.flush()
    
    # Record initial history
    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=creator_id,
        old_status=None,
        new_status="Open",
        comment="Issue reported and opened in system"
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "message": f"Issue {issue.id} created successfully",
        "issue": issue.to_dict(include_details=True)
    }), 201

@issues_bp.route("/<string:issue_id>", methods=["PUT"])
@jwt_required(optional=True)
def update_issue(issue_id):
    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    data = request.get_json(silent=True) or {}
    if "title" in data and data["title"].strip():
        issue.title = data["title"].strip()
    if "description" in data:
        issue.description = data["description"].strip()
    if "issue_type" in data:
        issue.issue_type = data["issue_type"]
    if "severity" in data:
        issue.severity = data["severity"]
    if "priority" in data:
        issue.priority = data["priority"]
    if "component" in data:
        issue.component = data["component"]
    if "environment" in data:
        issue.environment = data["environment"]
    if "steps_to_reproduce" in data:
        issue.steps_to_reproduce = data["steps_to_reproduce"]
    if "expected_result" in data:
        issue.expected_result = data["expected_result"]
    if "actual_result" in data:
        issue.actual_result = data["actual_result"]
    if "business_impact" in data:
        issue.business_impact = data["business_impact"]
    if "sprint_id" in data:
        issue.sprint_id = data["sprint_id"] or None
    if "assigned_to" in data:
        issue.assigned_to = data["assigned_to"] or None
        
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        "message": f"Issue {issue.id} updated successfully",
        "issue": issue.to_dict(include_details=True)
    }), 200

@issues_bp.route("/<string:issue_id>/assign", methods=["PATCH"])
@jwt_required()
def assign_issue(issue_id):
    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    ident = get_jwt_identity()
    requester = db.session.get(User, str(ident)) if ident else None
    
    data = request.get_json(silent=True) or {}
    assigned_to = data.get("assigned_to")
    
    if assigned_to:
        dev = db.session.get(User, str(assigned_to))
        if not dev:
            return jsonify({"error": "Assigned user does not exist"}), 404
        issue.assigned_to = dev.id
        assignee_name = dev.name
    else:
        issue.assigned_to = None
        assignee_name = "Unassigned"
        
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)

    # Record history
    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=requester.id if requester else None,
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Assigned to {assignee_name}"
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "message": f"Issue {issue.id} assigned to {assignee_name}",
        "issue": issue.to_dict(include_details=True)
    }), 200

@issues_bp.route("/<string:issue_id>/status", methods=["PATCH"])
@jwt_required(optional=True)
def update_status(issue_id):
    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    user_role = user.role if user else "Admin"
    
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    comment_text = data.get("comment", "").strip()
    resolution_summary = data.get("resolution_summary", "").strip()
    root_cause = data.get("root_cause", "").strip()
    
    if new_status not in WORKFLOW_STATES:
        return jsonify({"error": f"Invalid status. Must be one of {WORKFLOW_STATES}"}), 400
        
    old_status = issue.status
    
    # Workflow transition authorization checks
    if user_role == "Developer":
        # Developers work on issues: Open -> In Progress, In Progress -> Testing, In Progress/Testing -> Resolved
        allowed_transitions = {
            "Open": ["In Progress"],
            "In Progress": ["Testing", "Resolved"],
            "Testing": ["Resolved"],
            "Resolved": ["Testing"],
            "Closed": []
        }
        if new_status not in allowed_transitions.get(old_status, []):
            return jsonify({"error": f"Developers cannot transition an issue directly from '{old_status}' to '{new_status}'."}), 403
            
    elif user_role == "Tester":
        # Testers verify and test: Testing -> Resolved, Resolved -> Closed, or Reopen (Testing/Resolved/Closed -> In Progress / Open)
        allowed_transitions = {
            "Open": ["Testing"],
            "In Progress": ["Testing"],
            "Testing": ["Resolved", "In Progress", "Open"],
            "Resolved": ["Closed", "In Progress", "Testing"],
            "Closed": ["In Progress", "Open"]
        }
        if new_status not in allowed_transitions.get(old_status, []):
            return jsonify({"error": f"Testers cannot transition an issue from '{old_status}' to '{new_status}'."}), 403

    # Check for Reopen transition
    is_reopening = (old_status in ["Testing", "Resolved", "Closed"]) and (new_status in ["Open", "In Progress"])
    if is_reopening:
        issue.reopen_count = (issue.reopen_count or 0) + 1
        
    if new_status in ["Resolved", "Closed"]:
        issue.resolved_date = datetime.now().date()
        if resolution_summary:
            issue.resolution_summary = resolution_summary
        if root_cause:
            issue.root_cause = root_cause

    issue.status = new_status
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)
    
    history_comment = comment_text
    if not history_comment:
        if is_reopening:
            history_comment = f"Issue reopened from {old_status} to {new_status} (reopen count: {issue.reopen_count})"
        else:
            history_comment = f"Status changed from {old_status} to {new_status}"
            
    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id if user else None,
        old_status=old_status,
        new_status=new_status,
        comment=history_comment
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "message": f"Status updated from {old_status} to {new_status}",
        "issue": issue.to_dict(include_details=True)
    }), 200

@issues_bp.route("/<string:issue_id>/comments", methods=["POST"])
@jwt_required(optional=True)
def add_comment(issue_id):
    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Comment text cannot be empty"}), 400
        
    identity = get_jwt_identity()
    user = db.session.get(User, str(identity)) if identity else None
    user_id = user.id if user else data.get("user_id")
    
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

@issues_bp.route("/<string:issue_id>", methods=["DELETE"])
@jwt_required()
def delete_issue(issue_id):
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    if not user or user.role not in ["Admin", "Project Manager"]:
        return jsonify({"error": "Only Administrators and Project Managers are authorized to delete issues."}), 403

    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404
        
    db.session.delete(issue)
    db.session.commit()
    return jsonify({"message": f"Issue {issue_id} has been permanently deleted."}), 200
