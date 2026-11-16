import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import sqlalchemy as sa
from extensions import db
from models.issue import Issue
from models.project import Project
from models.user import User
from models.sprint import Sprint
from models.comment import IssueComment
from models.history import IssueStatusHistory
from models.attachment import IssueAttachment
from services.access_control import (
    get_current_user_and_role,
    get_scoped_issues_query,
    can_access_issue,
    can_access_project
)

issues_bp = Blueprint("issues", __name__, url_prefix="/api/issues")

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
    'pdf', 'doc', 'docx', 'txt', 'csv', 'log', 'json', 'zip', 'tar', 'gz'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

WORKFLOW_STATES = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
ISSUE_TYPES = ["Bug", "Feature Request", "Enhancement", "Technical Debt", "Support Ticket"]
AFFECTED_MODULES = [
    "Login",
    "Dashboard",
    "Registration",
    "User Management",
    "Projects",
    "Payment",
    "Reports",
    "Sprint Management",
    "Issue Management",
    "Other"
]
ENVIRONMENTS = ["Development", "Testing", "QA", "Staging", "Production"]
SEVERITIES = ["Critical", "High", "Medium", "Low"]
PRIORITY_MAP = {
    "P1 – Urgent": "P1", "P1 - Urgent": "P1", "Urgent": "P1", "P1": "P1", "p1": "P1",
    "P2 – High": "P2", "P2 - High": "P2", "High": "P2", "P2": "P2", "p2": "P2",
    "P3 – Medium": "P3", "P3 - Medium": "P3", "Medium": "P3", "P3": "P3", "p3": "P3",
    "P4 – Low": "P4", "P4 - Low": "P4", "Low": "P4", "P4": "P4", "p4": "P4",
    "Critical": "P1", "P0": "P1", "p0": "P1",
}

VALID_LIFECYCLE_TRANSITIONS = {
    "Open": ["In Progress"],
    "In Progress": ["Testing"],
    "Testing": ["Resolved", "In Progress"],
    "Resolved": ["Closed", "In Progress"],
    "Closed": ["Open"]
}

def validate_workflow_transition(old_status, new_status, user_role):
    if old_status == new_status:
        return True, ""
    
    # 1. Lifecycle structure check
    allowed_next = VALID_LIFECYCLE_TRANSITIONS.get(old_status, [])
    if new_status not in allowed_next:
        return False, f"Invalid workflow transition: cannot move issue directly from '{old_status}' to '{new_status}'. Valid next stages: {', '.join(allowed_next) if allowed_next else 'None'}."

    # 2. Role permission check
    role = (user_role or "").strip().upper().replace(" ", "_")
    if role in ["ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER"]:
        return True, ""
        
    if role == "DEVELOPER":
        if (old_status, new_status) in [("Open", "In Progress"), ("In Progress", "Testing")]:
            return True, ""
        return False, f"Developers can only transition issues from Open to In Progress, or In Progress to Testing."
        
    if role == "TESTER":
        if (old_status, new_status) in [
            ("Testing", "Resolved"),
            ("Testing", "In Progress"),
            ("Resolved", "Closed"),
            ("Resolved", "In Progress"),
            ("Closed", "Open")
        ]:
            return True, ""
        return False, f"Testers cannot execute status transition from '{old_status}' to '{new_status}'."
        
    return True, ""

def find_issue_by_id(issue_id):
    if not issue_id:
        return None
    issue = db.session.get(Issue, str(issue_id))
    if issue:
        return issue
    if isinstance(issue_id, str) and issue_id.upper().startswith("BUG-"):
        parts = issue_id.split("-")
        if len(parts) == 2 and parts[1].isdigit():
            padded = f"BUG-{int(parts[1]):05d}"
            issue = db.session.get(Issue, padded)
            if issue:
                return issue
            unpadded = f"BUG-{int(parts[1])}"
            issue = db.session.get(Issue, unpadded)
            if issue:
                return issue
    return None

@issues_bp.route("", methods=["GET"])
@jwt_required()
def get_issues():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    q = request.args.get("q", "").strip()
    status = request.args.get("status")
    severity = request.args.get("severity")
    priority = request.args.get("priority")
    issue_type = request.args.get("issue_type")
    affected_module = request.args.get("affected_module") or request.args.get("module")
    project_id = request.args.get("project_id")
    assignee_id = request.args.get("assignee_id") or request.args.get("assigned_to")
    reporter_id = request.args.get("reporter_id") or request.args.get("created_by")
    sprint_id = request.args.get("sprint_id")
    
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    sort_by = request.args.get("sort_by", "id")
    sort_dir = request.args.get("sort_dir", "desc")
    
    tester_view = request.args.get("tester_view") or request.args.get("view")
    
    # 1. Base query strictly scoped by role and user permissions
    query = get_scoped_issues_query(user, role)

    # Tester-specific view switching: My Reported Issues vs My Tests (verification)
    if role == "TESTER" and tester_view:
        if tester_view in ["reported", "my_reported"]:
            query = query.filter((Issue.reported_by == user.id) | (Issue.created_by == user.id))
        elif tester_view in ["tests", "verification", "my_tests"]:
            query = query.filter(Issue.status == "Testing")
    
    # Text search
    if q:
        query = query.filter(
            (Issue.title.ilike(f"%{q}%")) |
            (Issue.description.ilike(f"%{q}%")) |
            (Issue.id.ilike(f"%{q}%")) |
            (Issue.component.ilike(f"%{q}%")) |
            (Issue.affected_module.ilike(f"%{q}%"))
        )
        
    # Filters
    if status and status != "All":
        query = query.filter(Issue.status == status)
    if severity and severity != "All":
        query = query.filter(Issue.severity == severity)
    if priority and priority != "All":
        clean_p = PRIORITY_MAP.get(priority, priority)
        query = query.filter(Issue.priority.ilike(f"%{clean_p}%"))
    if issue_type and issue_type != "All":
        query = query.filter(Issue.issue_type == issue_type)
    if affected_module and affected_module != "All":
        query = query.filter(
            (Issue.affected_module == affected_module) |
            (Issue.component == affected_module)
        )
    if project_id and project_id != "All":
        query = query.filter(Issue.project_id == project_id)
    if assignee_id and assignee_id != "All":
        if assignee_id == "unassigned":
            query = query.filter(Issue.assigned_to == None)
        else:
            query = query.filter(Issue.assigned_to == assignee_id)
    if reporter_id and reporter_id != "All":
        query = query.filter((Issue.reported_by == reporter_id) | (Issue.created_by == reporter_id))
    if sprint_id and sprint_id != "All":
        if sprint_id == "none" or sprint_id == "backlog":
            query = query.filter(Issue.sprint_id == None)
        else:
            query = query.filter(Issue.sprint_id == sprint_id)
            
    # Ordering
    sort_column_map = {
        "id": Issue.id,
        "title": Issue.title,
        "status": Issue.status,
        "priority": Issue.priority,
        "severity": Issue.severity,
        "created_date": Issue.created_date,
        "updated_date": Issue.updated_date,
        "created_at": Issue.created_at,
        "updated_at": Issue.updated_at,
        "reopen_count": Issue.reopen_count
    }
    col = sort_column_map.get(sort_by, Issue.id)
    
    if sort_by == "id":
        num_expr = sa.cast(sa.func.nullif(sa.func.regexp_replace(Issue.id, r'[^0-9]', '', 'g'), ''), sa.BigInteger)
        order_clause = num_expr.desc() if sort_dir == "desc" else num_expr.asc()
    else:
        order_clause = col.desc().nullslast() if sort_dir == "desc" else col.asc().nullsfirst()
        
    query = query.order_by(order_clause)
    
    total = query.count()
    issues = query.offset((page - 1) * per_page).limit(per_page).all()
    
    # Calculate scoped summary counts from PostgreSQL for dashboard cards
    base_scoped = get_scoped_issues_query(user, role)
    if project_id and project_id != "All":
        base_scoped = base_scoped.filter(Issue.project_id == project_id)
        
    summary_counts = {
        "total": base_scoped.count(),
        "open": base_scoped.filter(Issue.status == "Open").count(),
        "in_progress": base_scoped.filter(Issue.status == "In Progress").count(),
        "resolved": base_scoped.filter(Issue.status == "Resolved").count(),
        "closed": base_scoped.filter(Issue.status == "Closed").count(),
        "testing": base_scoped.filter(Issue.status == "Testing").count(),
    }
    
    issues_list = [i.to_dict(include_details=False) for i in issues]
    
    return jsonify({
        "success": True,
        "issues": issues_list,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "summary": summary_counts,
        "data": {
            "issues": issues_list,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
            "summary": summary_counts
        }
    }), 200

@issues_bp.route("/<string:issue_id>", methods=["GET"])
@jwt_required()
def get_issue(issue_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"success": False, "error": "Issue not found"}), 404

    if not can_access_issue(user, role, issue):
        return jsonify({"success": False, "error": "You do not have permission to view this issue."}), 403

    issue_dict = issue.to_dict(include_details=True)
    resp = dict(issue_dict)
    resp["success"] = True
    resp["data"] = issue_dict
    return jsonify(resp), 200

@issues_bp.route("", methods=["POST"])
@jwt_required()
def create_issue():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    
    project_id = data.get("project_id")
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    issue_type = data.get("issue_type", "Bug")
    severity = data.get("severity", "Medium")
    raw_pri = data.get("priority", "P2")
    priority = PRIORITY_MAP.get(raw_pri, raw_pri)
    
    assigned_to = data.get("assigned_to") or None
    affected_module = data.get("affected_module") or data.get("module") or "Other"
    component = data.get("component") or affected_module
    environment = data.get("environment", "Development")
    steps_to_reproduce = data.get("steps_to_reproduce")
    expected_result = data.get("expected_result")
    actual_result = data.get("actual_result")
    business_impact = data.get("business_impact")
    sprint_id = data.get("sprint_id") or None
    
    if not project_id:
        return jsonify({"success": False, "error": "Project selection is required."}), 400
    if not title:
        return jsonify({"success": False, "error": "Issue title is required."}), 400
    if not description:
        return jsonify({"success": False, "error": "Issue description is required."}), 400
    if not issue_type:
        return jsonify({"success": False, "error": "Issue type is required."}), 400
    if not severity:
        return jsonify({"success": False, "error": "Severity selection is required."}), 400
    if not priority:
        return jsonify({"success": False, "error": "Priority selection is required."}), 400
        
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"success": False, "error": "Specified project does not exist."}), 404

    if role == "PROJECT_MANAGER" and not can_access_project(user, role, project):
        return jsonify({"success": False, "error": "You do not have permission to create issues in this project."}), 403
        
    creator_id = user.id

    if assigned_to:
        dev = db.session.get(User, str(assigned_to))
        if not dev:
            assigned_to = None

    # Sequential Issue ID generation: BUG-xxxxx
    max_num = db.session.query(
        sa.func.max(sa.cast(sa.func.nullif(sa.func.regexp_replace(Issue.id, r'[^0-9]', '', 'g'), ''), sa.BigInteger))
    ).filter(Issue.id.ilike('BUG-%')).scalar() or 0
    next_num = max_num + 1
    new_id = f"BUG-{next_num:05d}"
    while db.session.get(Issue, new_id):
        next_num += 1
        new_id = f"BUG-{next_num:05d}"

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
        affected_module=affected_module,
        component=component or affected_module,
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
        action_type="CREATED",
        field_name="status",
        old_status=None,
        new_status="Open",
        new_value="Open",
        comment="Issue reported and opened in system"
    )
    db.session.add(history)
    db.session.commit()
    
    issue_dict = issue.to_dict(include_details=True)
    return jsonify({
        "success": True,
        "message": f"Issue {issue.id} created successfully",
        "data": {
            "issue_id": issue.id,
            "issue": issue_dict
        },
        "issue": issue_dict
    }), 201

@issues_bp.route("/<string:issue_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_issue(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"success": False, "error": "Issue not found"}), 404
        
    if not can_access_issue(user, user_role, issue):
        return jsonify({"success": False, "error": "You do not have permission to modify this issue."}), 403

    data = request.get_json(silent=True) or {}
    
    # Basic text fields
    details_changed = False
    if "title" in data and data["title"].strip() and data["title"].strip() != issue.title:
        issue.title = data["title"].strip()
        details_changed = True
    if "description" in data and data["description"].strip() != (issue.description or ""):
        issue.description = data["description"].strip()
        details_changed = True
    if "issue_type" in data and data["issue_type"] and data["issue_type"] != issue.issue_type:
        issue.issue_type = data["issue_type"]
        details_changed = True

    # Severity update
    if "severity" in data and data["severity"] and data["severity"] != issue.severity:
        old_sev = issue.severity
        new_sev = data["severity"]
        issue.severity = new_sev
        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id if user else None,
            action_type="SEVERITY_CHANGE",
            field_name="severity",
            old_value=old_sev,
            new_value=new_sev,
            old_status=issue.status,
            new_status=issue.status,
            comment=f"Severity changed from {old_sev} to {new_sev}"
        ))

    # Priority update
    if "priority" in data and data["priority"]:
        new_pri_code = PRIORITY_MAP.get(data["priority"], data["priority"])
        if new_pri_code != issue.priority:
            pri_labels = {"P0": "Critical", "P1": "Urgent", "P2": "High", "P3": "Medium", "P4": "Low"}
            old_pri_code = issue.priority
            old_pri_label = pri_labels.get(old_pri_code, old_pri_code)
            new_pri_label = pri_labels.get(new_pri_code, new_pri_code)
            issue.priority = new_pri_code
            db.session.add(IssueStatusHistory(
                issue_id=issue.id,
                changed_by_id=user.id if user else None,
                action_type="PRIORITY_CHANGE",
                field_name="priority",
                old_value=old_pri_label,
                new_value=new_pri_label,
                old_status=issue.status,
                new_status=issue.status,
                comment=f"Priority changed from {old_pri_label} to {new_pri_label}"
            ))

    if "affected_module" in data and data["affected_module"] and data["affected_module"] != issue.affected_module:
        issue.affected_module = data["affected_module"].strip()
        details_changed = True
    elif "module" in data and data["module"] and data["module"] != issue.affected_module:
        issue.affected_module = data["module"].strip()
        details_changed = True

    if "component" in data:
        issue.component = data["component"]
    if "environment" in data and data["environment"] != issue.environment:
        issue.environment = data["environment"]
        details_changed = True
    if "steps_to_reproduce" in data:
        issue.steps_to_reproduce = data["steps_to_reproduce"]
    if "expected_result" in data:
        issue.expected_result = data["expected_result"]
    if "actual_result" in data:
        issue.actual_result = data["actual_result"]
    if "business_impact" in data:
        issue.business_impact = data["business_impact"]

    # Sprint update
    if "sprint_id" in data and data["sprint_id"] != issue.sprint_id:
        new_sp_id = data["sprint_id"] or None
        old_sp_name = issue.sprint.name if issue.sprint else "Backlog"
        issue.sprint_id = new_sp_id
        new_sp = db.session.get(Sprint, new_sp_id) if new_sp_id else None
        new_sp_name = new_sp.name if new_sp else "Backlog"
        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id if user else None,
            action_type="SPRINT_ASSIGNED",
            field_name="sprint_id",
            old_value=old_sp_name,
            new_value=new_sp_name,
            old_status=issue.status,
            new_status=issue.status,
            comment=f"Assigned to sprint {new_sp_name}"
        ))

    # Project reassignment
    if "project_id" in data and data["project_id"] and data["project_id"] != issue.project_id:
        if user_role not in ["ADMIN", "PROJECT_MANAGER"]:
            return jsonify({"error": "Only Admins and Project Managers can move issues between projects."}), 403
        new_proj = db.session.get(Project, data["project_id"])
        if not new_proj:
            return jsonify({"error": "Specified project does not exist"}), 404
        if not can_access_project(user, user_role, new_proj):
            return jsonify({"error": "You do not have permission to move issues to this project."}), 403
        old_pname = issue.project.name if issue.project else issue.project_id
        issue.project_id = new_proj.id
        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id if user else None,
            action_type="PROJECT_CHANGE",
            field_name="project_id",
            old_value=old_pname,
            new_value=new_proj.name,
            old_status=issue.status,
            new_status=issue.status,
            comment=f"Moved project from {old_pname} to {new_proj.name}"
        ))

    # Assigned Developer update
    if "assigned_to" in data:
        new_assignee_id = data["assigned_to"] or None
        if new_assignee_id != issue.assigned_to:
            if user_role not in ["ADMIN", "PROJECT_MANAGER"]:
                return jsonify({"error": "Only Admins and Project Managers can assign issues."}), 403
            old_dev = db.session.get(User, str(issue.assigned_to)) if issue.assigned_to else None
            old_dev_name = old_dev.name if old_dev else "Unassigned"
            if new_assignee_id:
                dev = db.session.get(User, str(new_assignee_id))
                if not dev:
                    return jsonify({"error": "Assigned user does not exist"}), 404
                issue.assigned_to = dev.id
                assignee_name = dev.name
            else:
                issue.assigned_to = None
                assignee_name = "Unassigned"
            db.session.add(IssueStatusHistory(
                issue_id=issue.id,
                changed_by_id=user.id if user else None,
                action_type="ASSIGNMENT",
                field_name="assigned_to",
                old_value=old_dev_name,
                new_value=assignee_name,
                old_status=issue.status,
                new_status=issue.status,
                comment=f"Assigned to {assignee_name}"
            ))

    # Status & Workflow transition update
    if "status" in data and data["status"] and data["status"] != issue.status:
        new_status = data["status"]
        if new_status not in WORKFLOW_STATES:
            return jsonify({"error": f"Invalid status. Must be one of {WORKFLOW_STATES}"}), 400
            
        ok, err_msg = validate_workflow_transition(issue.status, new_status, user_role)
        if not ok:
            return jsonify({"error": err_msg}), 400
            
        old_status = issue.status
        is_reopening = (old_status in ["Testing", "Resolved", "Closed"]) and (new_status in ["Open", "In Progress"])
        if is_reopening:
            issue.reopen_count = (issue.reopen_count or 0) + 1
        if new_status in ["Resolved", "Closed"]:
            issue.resolved_date = datetime.now().date()
            if "resolution_summary" in data and data["resolution_summary"]:
                issue.resolution_summary = data["resolution_summary"].strip()
            if "root_cause" in data and data["root_cause"]:
                issue.root_cause = data["root_cause"].strip()
                
        issue.status = new_status
        hist_comment = data.get("comment") or (
            f"Issue reopened from {old_status} to {new_status} (reopen count: {issue.reopen_count})" if is_reopening else f"Status changed from {old_status} to {new_status}"
        )
        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id if user else None,
            action_type="STATUS_CHANGE",
            field_name="status",
            old_value=old_status,
            new_value=new_status,
            old_status=old_status,
            new_status=new_status,
            comment=hist_comment
        ))
    elif details_changed and not ("status" in data and data["status"] != issue.status):
        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id if user else None,
            action_type="ISSUE_UPDATED",
            field_name="details",
            old_status=issue.status,
            new_status=issue.status,
            comment=data.get("comment") or "Updated issue details"
        ))
        
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    issue_dict = issue.to_dict(include_details=True)
    return jsonify({
        "success": True,
        "message": f"Issue {issue.id} updated successfully",
        "data": {
            "issue_id": issue.id,
            "issue": issue_dict
        },
        "issue": issue_dict
    }), 200

@issues_bp.route("/<string:issue_id>/assign", methods=["PATCH"])
@jwt_required()
def assign_issue(issue_id):
    ident = get_jwt_identity()
    requester, requester_role = get_current_user_and_role(ident)
    if not requester:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    if requester_role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"success": False, "error": "Only Admins and Project Managers can assign issues."}), 403

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"success": False, "error": "Issue not found"}), 404

    if not can_access_issue(requester, requester_role, issue):
        return jsonify({"success": False, "error": "You do not have permission to assign this issue."}), 403
    
    data = request.get_json(silent=True) or {}
    assigned_to = data.get("assigned_to")
    
    old_dev = db.session.get(User, str(issue.assigned_to)) if issue.assigned_to else None
    old_dev_name = old_dev.name if old_dev else "Unassigned"

    if assigned_to:
        dev = db.session.get(User, str(assigned_to))
        if not dev:
            return jsonify({"success": False, "error": "Assigned user does not exist"}), 404
        issue.assigned_to = dev.id
        assignee_name = dev.name
    else:
        issue.assigned_to = None
        assignee_name = "Unassigned"
        
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)

    history = IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=requester.id if requester else None,
        action_type="ASSIGNMENT",
        field_name="assigned_to",
        old_value=old_dev_name,
        new_value=assignee_name,
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Assigned to {assignee_name}"
    )
    db.session.add(history)
    db.session.commit()
    
    issue_dict = issue.to_dict(include_details=True)
    return jsonify({
        "success": True,
        "message": f"Issue {issue.id} assigned to {assignee_name}",
        "data": {
            "issue_id": issue.id,
            "assigned_to": issue.assigned_to,
            "assignee_name": assignee_name,
            "issue": issue_dict
        },
        "issue": issue_dict
    }), 200

@issues_bp.route("/<string:issue_id>/status", methods=["PATCH", "PUT"])
@jwt_required()
def update_status(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"success": False, "error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"success": False, "error": "You do not have permission to update this issue status."}), 403
    
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    comment_text = data.get("comment", "").strip()
    resolution_summary = data.get("resolution_summary", "").strip()
    root_cause = data.get("root_cause", "").strip()
    
    if new_status not in WORKFLOW_STATES:
        return jsonify({"success": False, "error": f"Invalid status. Must be one of {WORKFLOW_STATES}"}), 400
        
    old_status = issue.status
    
    # Workflow transition authorization checks
    ok, err_msg = validate_workflow_transition(old_status, new_status, user_role)
    if not ok:
        return jsonify({"success": False, "error": err_msg}), 400

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
        action_type="STATUS_CHANGE",
        field_name="status",
        old_value=old_status,
        new_value=new_status,
        old_status=old_status,
        new_status=new_status,
        comment=history_comment
    )
    db.session.add(history)
    db.session.commit()
    
    issue_dict = issue.to_dict(include_details=True)
    return jsonify({
        "success": True,
        "message": f"Status updated from {old_status} to {new_status}",
        "data": {
            "issue_id": issue.id,
            "old_status": old_status,
            "new_status": new_status,
            "issue": issue_dict
        },
        "issue": issue_dict
    }), 200

# ----------------------------------------------------
# COMMENTS COLLABORATION ENDPOINTS (ADD, EDIT, DELETE)
# ----------------------------------------------------

@issues_bp.route("/<string:issue_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to view comments for this issue."}), 403

    comments = issue.comments.order_by(IssueComment.created_at.asc()).all()
    return jsonify([c.to_dict() for c in comments]), 200

@issues_bp.route("/<string:issue_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to comment on this issue."}), 403
        
    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Comment text cannot be empty."}), 400
        
    comment = IssueComment(
        issue_id=issue.id,
        user_id=user.id,
        content=content
    )
    db.session.add(comment)

    # Record in history
    db.session.add(IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id,
        action_type="COMMENT_ADDED",
        field_name="comment",
        old_status=issue.status,
        new_status=issue.status,
        comment=content[:120]
    ))
    db.session.commit()
    
    return jsonify({
        "message": "Comment posted successfully",
        "comment": comment.to_dict()
    }), 201

@issues_bp.route("/<string:issue_id>/comments/<int:comment_id>", methods=["PUT"])
@jwt_required()
def update_comment(issue_id, comment_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    comment = db.session.get(IssueComment, comment_id)
    if not comment or comment.issue_id != issue.id:
        return jsonify({"error": "Comment not found"}), 404

    if user_role not in ["ADMIN", "PROJECT_MANAGER"] and comment.user_id != user.id:
        return jsonify({"error": "You can only edit comments posted by yourself."}), 403

    data = request.get_json(silent=True) or {}
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Comment text cannot be empty."}), 400

    comment.content = content
    comment.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "message": "Comment updated successfully.",
        "comment": comment.to_dict()
    }), 200

@issues_bp.route("/<string:issue_id>/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(issue_id, comment_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    comment = db.session.get(IssueComment, comment_id)
    if not comment or comment.issue_id != issue.id:
        return jsonify({"error": "Comment not found"}), 404

    if user_role not in ["ADMIN", "PROJECT_MANAGER"] and comment.user_id != user.id:
        return jsonify({"error": "You can only delete comments posted by yourself."}), 403

    db.session.delete(comment)
    db.session.commit()

    return jsonify({"message": "Comment deleted successfully."}), 200

# ----------------------------------------------------
# ATTACHMENTS SYSTEM ENDPOINTS
# ----------------------------------------------------

@issues_bp.route("/<string:issue_id>/attachments", methods=["GET"])
@jwt_required()
def get_attachments(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to view attachments for this issue."}), 403

    attachments = IssueAttachment.query.filter_by(issue_id=issue_id).order_by(IssueAttachment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in attachments]), 200

@issues_bp.route("/<string:issue_id>/attachments", methods=["POST"])
@jwt_required()
def upload_attachment(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to upload attachments to this issue."}), 403

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded. Key 'file' is required in form-data."}), 400

    file = request.files['file']
    if not file or not file.filename.strip():
        return jsonify({"error": "Selected file is empty."}), 400

    original_name = file.filename.strip()
    if not allowed_file(original_name):
        return jsonify({"error": f"Unsupported file type. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}), 400

    file_bytes = file.read()
    file_size = len(file_bytes)
    if file_size > 10 * 1024 * 1024:
        return jsonify({"error": "File size exceeds the 10 MB limit."}), 400

    sec_name = secure_filename(original_name) or "attachment"
    storage_filename = f"{uuid.uuid4().hex[:12]}_{sec_name}"
    storage_path = os.path.join(UPLOAD_FOLDER, storage_filename)

    with open(storage_path, "wb") as f:
        f.write(file_bytes)

    attachment = IssueAttachment(
        issue_id=issue.id,
        user_id=user.id,
        filename=original_name,
        file_path=storage_filename,
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream"
    )
    db.session.add(attachment)

    db.session.add(IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id,
        action_type="ATTACHMENT_UPLOADED",
        field_name="attachment",
        new_value=original_name,
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Uploaded file: {original_name} ({IssueAttachment.format_file_size(file_size)})"
    ))
    db.session.commit()

    return jsonify({
        "message": f"File '{original_name}' uploaded successfully.",
        "attachment": attachment.to_dict()
    }), 201

@issues_bp.route("/<string:issue_id>/attachments/<int:attachment_id>/download", methods=["GET"])
@jwt_required()
def download_attachment(issue_id, attachment_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to download this attachment."}), 403

    attachment = db.session.get(IssueAttachment, attachment_id)
    if not attachment or attachment.issue_id != issue.id:
        return jsonify({"error": "Attachment not found"}), 404

    file_path = os.path.join(UPLOAD_FOLDER, attachment.file_path)
    if not os.path.isfile(file_path):
        return jsonify({"error": "File not found on storage server."}), 404

    return send_from_directory(
        UPLOAD_FOLDER,
        attachment.file_path,
        as_attachment=True,
        download_name=attachment.filename
    )

@issues_bp.route("/<string:issue_id>/attachments/<int:attachment_id>", methods=["DELETE"])
@jwt_required()
def delete_attachment(issue_id, attachment_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to delete this attachment."}), 403

    attachment = db.session.get(IssueAttachment, attachment_id)
    if not attachment or attachment.issue_id != issue.id:
        return jsonify({"error": "Attachment not found"}), 404

    if user_role not in ["ADMIN", "PROJECT_MANAGER"] and attachment.user_id != user.id:
        return jsonify({"error": "You can only delete attachments uploaded by yourself."}), 403

    filename = attachment.filename
    file_path = os.path.join(UPLOAD_FOLDER, attachment.file_path)
    if os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.session.delete(attachment)
    db.session.add(IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id,
        action_type="ATTACHMENT_DELETED",
        field_name="attachment",
        old_value=filename,
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Deleted attachment: {filename}"
    ))
    db.session.commit()

    return jsonify({"message": f"Attachment '{filename}' deleted successfully."}), 200

# ----------------------------------------------------
# ACTIVITY HISTORY & RELATED ISSUES ENDPOINTS
# ----------------------------------------------------

@issues_bp.route("/<string:issue_id>/activity", methods=["GET"])
@jwt_required()
def get_issue_activity(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to view activity for this issue."}), 403

    activities = issue.status_history.order_by(IssueStatusHistory.created_at.desc()).all()
    return jsonify([a.to_dict() for a in activities]), 200

@issues_bp.route("/<string:issue_id>/related", methods=["GET"])
@jwt_required()
def get_related_issues(issue_id):
    ident = get_jwt_identity()
    user, user_role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, user_role, issue):
        return jsonify({"error": "You do not have permission to view this issue."}), 403

    related = Issue.query.filter(
        Issue.id != issue.id,
        sa.or_(
            Issue.project_id == issue.project_id,
            (Issue.sprint_id == issue.sprint_id) if issue.sprint_id else sa.false(),
            Issue.duplicate_of_issue_id == issue.id,
            Issue.id == issue.duplicate_of_issue_id
        )
    ).order_by(Issue.id.desc()).limit(10).all()

    return jsonify([i.to_dict(include_details=False) for i in related]), 200

@issues_bp.route("/<string:issue_id>", methods=["DELETE"])
@jwt_required()
def delete_issue(issue_id):
    ident = get_jwt_identity()
    user, role_raw = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    if role_raw not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"success": False, "error": "Only Administrators and Project Managers are authorized to delete issues."}), 403

    issue = find_issue_by_id(issue_id)
    if not issue:
        return jsonify({"success": False, "error": "Issue not found"}), 404

    if not can_access_issue(user, role_raw, issue):
        return jsonify({"success": False, "error": "You do not have permission to delete this issue."}), 403

    deleted_id = issue.id
    db.session.delete(issue)
    db.session.commit()
    return jsonify({
        "success": True,
        "message": f"Issue {deleted_id} has been permanently deleted.",
        "data": {
            "issue_id": deleted_id
        }
    }), 200
