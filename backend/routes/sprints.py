from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
import sqlalchemy as sa
from extensions import db
from models.sprint import Sprint
from models.project import Project
from models.user import User
from models.issue import Issue
from models.history import IssueStatusHistory
from services.access_control import (
    get_current_user_and_role,
    get_user_accessible_project_ids,
    can_access_project,
    can_access_issue
)

sprints_bp = Blueprint("sprints", __name__, url_prefix="/api/sprints")

def parse_d(d):
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return None

@sprints_bp.route("", methods=["GET"])
@jwt_required()
def get_sprints():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    project_id = request.args.get("project_id")
    status = request.args.get("status")
    
    query = Sprint.query
    accessible_pids = get_user_accessible_project_ids(user, role)
    
    if role in ["ADMIN", "ADMINISTRATOR"]:
        if project_id and project_id != "All":
            query = query.filter(Sprint.project_id == project_id)
    elif role == "PROJECT_MANAGER":
        if project_id and project_id != "All":
            if accessible_pids is not None and project_id not in accessible_pids:
                return jsonify({"error": "You do not have permission to view sprints for this project."}), 403
            query = query.filter(Sprint.project_id == project_id)
        else:
            query = query.filter(Sprint.project_id.in_(accessible_pids)) if accessible_pids else query.filter(sa.false())
    elif role == "DEVELOPER":
        dev_sprint_ids = [r[0] for r in db.session.query(sa.distinct(Issue.sprint_id)).filter(
            Issue.assigned_to == user.id,
            Issue.sprint_id.isnot(None)
        ).all() if r[0]]
        if project_id and project_id != "All":
            query = query.filter(Sprint.project_id == project_id)
            if dev_sprint_ids:
                query = query.filter(Sprint.id.in_(dev_sprint_ids))
        else:
            if dev_sprint_ids:
                query = query.filter(Sprint.id.in_(dev_sprint_ids))
            elif accessible_pids:
                query = query.filter(Sprint.project_id.in_(accessible_pids))
            else:
                query = query.filter(sa.false())
    elif role == "TESTER":
        tester_sprint_ids = [r[0] for r in db.session.query(sa.distinct(Issue.sprint_id)).filter(
            (Issue.reported_by == user.id) | (Issue.created_by == user.id) | (Issue.status == "Testing"),
            Issue.sprint_id.isnot(None)
        ).all() if r[0]]
        if project_id and project_id != "All":
            query = query.filter(Sprint.project_id == project_id)
            if tester_sprint_ids:
                query = query.filter(Sprint.id.in_(tester_sprint_ids))
        else:
            if tester_sprint_ids:
                query = query.filter(Sprint.id.in_(tester_sprint_ids))
            elif accessible_pids:
                query = query.filter(Sprint.project_id.in_(accessible_pids))
            else:
                query = query.filter(sa.false())
    else:
        query = query.filter(sa.false())

    if status and status != "All":
        query = query.filter(Sprint.status == status)
        
    sprints = query.order_by(Sprint.start_date.desc().nullslast()).all()
    return jsonify([s.to_dict() for s in sprints]), 200

@sprints_bp.route("/<string:sprint_id>", methods=["GET"])
@jwt_required()
def get_sprint(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    has_access = can_access_project(user, role, sprint.project)
    if not has_access:
        if role == "DEVELOPER":
            has_access = Issue.query.filter_by(sprint_id=sprint.id, assigned_to=user.id).first() is not None
        elif role == "TESTER":
            has_access = Issue.query.filter(
                Issue.sprint_id == sprint.id,
                (Issue.reported_by == user.id) | (Issue.created_by == user.id) | (Issue.status == "Testing")
            ).first() is not None

    if not has_access:
        return jsonify({"error": "You do not have permission to view this sprint."}), 403

    return jsonify(sprint.to_dict(include_issues=True)), 200

@sprints_bp.route("/<string:sprint_id>/backlog", methods=["GET"])
@jwt_required()
def get_sprint_backlog(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to view backlog for this project."}), 403

    # Backlog: Project issues not currently assigned to this sprint
    query = Issue.query.filter(
        Issue.project_id == sprint.project_id,
        sa.or_(Issue.sprint_id == None, Issue.sprint_id != sprint_id)
    )

    q = request.args.get("q", "").strip()
    if q:
        query = query.filter(sa.or_(
            Issue.title.ilike(f"%{q}%"),
            Issue.id.ilike(f"%{q}%"),
            Issue.affected_module.ilike(f"%{q}%")
        ))
    
    severity = request.args.get("severity")
    if severity and severity != "All":
        query = query.filter(Issue.severity == severity)
        
    priority = request.args.get("priority")
    if priority and priority != "All":
        query = query.filter(Issue.priority.ilike(f"%{priority}%"))

    status = request.args.get("status")
    if status and status != "All":
        query = query.filter(Issue.status == status)

    issues = query.order_by(Issue.id.asc()).all()
    return jsonify([i.to_dict() for i in issues]), 200

@sprints_bp.route("/<string:sprint_id>/issues", methods=["POST"])
@jwt_required()
def add_issue_to_sprint(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can assign issues to sprints."}), 403

    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to modify this sprint."}), 403

    data = request.get_json(silent=True) or {}
    issue_id = data.get("issue_id")
    if not issue_id:
        return jsonify({"error": "issue_id is required."}), 400

    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if issue.project_id != sprint.project_id:
        return jsonify({"error": f"Issue {issue.id} belongs to project {issue.project_id}, whereas sprint belongs to {sprint.project_id}."}), 400

    if issue.sprint_id == sprint.id:
        return jsonify({"error": f"Issue {issue.id} is already assigned to sprint {sprint.name}."}), 400

    old_sprint = issue.sprint.name if issue.sprint else "Backlog"
    issue.sprint_id = sprint.id
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)

    db.session.add(IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id,
        action_type="SPRINT_ASSIGNED",
        field_name="sprint_id",
        old_value=old_sprint,
        new_value=sprint.name,
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Assigned to sprint {sprint.name}"
    ))
    db.session.commit()

    return jsonify({
        "message": f"Issue {issue.id} added to sprint {sprint.name}.",
        "issue": issue.to_dict()
    }), 200

@sprints_bp.route("/<string:sprint_id>/issues/<string:issue_id>", methods=["DELETE"])
@jwt_required()
def remove_issue_from_sprint(sprint_id, issue_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can remove issues from sprints."}), 403

    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to modify this sprint."}), 403

    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if issue.sprint_id != sprint.id:
        return jsonify({"error": f"Issue {issue.id} is not in sprint {sprint.id}."}), 400

    issue.sprint_id = None
    issue.updated_date = datetime.now().date()
    issue.updated_at = datetime.now(timezone.utc)

    db.session.add(IssueStatusHistory(
        issue_id=issue.id,
        changed_by_id=user.id,
        action_type="SPRINT_ASSIGNED",
        field_name="sprint_id",
        old_value=sprint.name,
        new_value="Backlog",
        old_status=issue.status,
        new_status=issue.status,
        comment=f"Removed from sprint {sprint.name} to backlog"
    ))
    db.session.commit()

    return jsonify({
        "message": f"Issue {issue.id} removed from sprint {sprint.name}.",
        "issue": issue.to_dict()
    }), 200

@sprints_bp.route("/<string:sprint_id>/issues/<string:issue_id>/status", methods=["PATCH", "PUT"])
@jwt_required()
def update_sprint_issue_status(sprint_id, issue_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    issue = db.session.get(Issue, issue_id)
    if not issue:
        return jsonify({"error": "Issue not found"}), 404

    if not can_access_issue(user, role, issue):
        return jsonify({"error": "You do not have permission to update this issue."}), 403

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    
    # Normalize common status names
    if new_status in ["Done", "done"]:
        new_status = "Resolved"
    elif new_status in ["To Do", "Todo", "todo", "TO DO"]:
        new_status = "Open"
    elif new_status in ["In Prog", "In-Progress", "in progress"]:
        new_status = "In Progress"

    # Import workflow validation from issues
    from routes.issues import validate_workflow_transition, WORKFLOW_STATES
    if new_status not in WORKFLOW_STATES:
        return jsonify({"error": f"Invalid status. Must be one of {WORKFLOW_STATES}"}), 400

    old_status = issue.status
    if old_status != new_status:
        norm_role = (role or "").strip().upper().replace(" ", "_")
        # Admins and Project Managers have board override permissions across sprint columns
        if norm_role not in ["ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER"]:
            ok, err_msg = validate_workflow_transition(old_status, new_status, role)
            if not ok:
                return jsonify({"error": err_msg}), 403

        is_reopening = (old_status in ["Testing", "Resolved", "Closed"]) and (new_status in ["Open", "In Progress"])
        if is_reopening:
            issue.reopen_count = (issue.reopen_count or 0) + 1

        issue.status = new_status
        issue.updated_date = datetime.now().date()
        issue.updated_at = datetime.now(timezone.utc)
        
        if new_status in ["Resolved", "Closed"]:
            issue.resolved_date = datetime.now().date()

        db.session.add(IssueStatusHistory(
            issue_id=issue.id,
            changed_by_id=user.id,
            action_type="STATUS_CHANGE",
            field_name="status",
            old_value=old_status,
            new_value=new_status,
            old_status=old_status,
            new_status=new_status,
            comment=f"Status changed from {old_status} to {new_status} via Sprint Board"
        ))
        db.session.commit()

    return jsonify({
        "message": f"Issue {issue.id} status updated to {new_status}.",
        "issue": issue.to_dict()
    }), 200

@sprints_bp.route("", methods=["POST"])
@jwt_required()
def create_sprint():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can create sprints."}), 403
        
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id")
    name = data.get("name", "").strip()
    goal = data.get("goal", "").strip()
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")
    
    if not project_id or not name:
        return jsonify({"error": "Project and Sprint Name are required."}), 400
        
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Specified project does not exist."}), 404

    if not can_access_project(user, role, project):
        return jsonify({"error": "You do not have permission to create sprints for this project."}), 403

    parsed_start = parse_d(start_date_str)
    parsed_end = parse_d(end_date_str)
    if parsed_start and parsed_end and parsed_end < parsed_start:
        return jsonify({"error": "End date cannot be earlier than start date."}), 400

    # Generate sprint ID preserving SP-XXX-YY format
    sp_count = Sprint.query.filter_by(project_id=project_id).count()
    clean_p_num = project_id.replace("PRJ-", "")
    new_sp_id = f"SP-{clean_p_num}-{sp_count + 1:02d}"
    while db.session.get(Sprint, new_sp_id):
        sp_count += 1
        new_sp_id = f"SP-{clean_p_num}-{sp_count + 1:02d}"

    sprint = Sprint(
        id=new_sp_id,
        project_id=project_id,
        name=name,
        sprint_name=name,
        goal=goal,
        start_date=parsed_start,
        end_date=parsed_end,
        status="PLANNED",
        created_by=user.id
    )
    db.session.add(sprint)
    db.session.commit()
    
    return jsonify({
        "message": "Sprint created successfully.",
        "sprint": sprint.to_dict()
    }), 201

@sprints_bp.route("/<string:sprint_id>", methods=["PUT"])
@jwt_required()
def update_sprint(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can update sprints."}), 403
        
    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to modify sprints for this project."}), 403

    data = request.get_json(silent=True) or {}
    name = data.get("name") or data.get("sprint_name")
    if name:
        sprint.name = name.strip()
        sprint.sprint_name = name.strip()
    if "goal" in data:
        sprint.goal = (data.get("goal") or "").strip()
    if "start_date" in data:
        sprint.start_date = parse_d(data.get("start_date"))
    if "end_date" in data:
        sprint.end_date = parse_d(data.get("end_date"))
    if sprint.start_date and sprint.end_date and sprint.end_date < sprint.start_date:
        return jsonify({"error": "End date cannot be earlier than start date."}), 400
    if "status" in data and data["status"] in ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]:
        sprint.status = data["status"]

    db.session.commit()
    return jsonify({
        "message": "Sprint updated successfully.",
        "sprint": sprint.to_dict()
    }), 200

@sprints_bp.route("/<string:sprint_id>/status", methods=["PATCH"])
@jwt_required()
def update_sprint_status(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can update sprint status."}), 403
        
    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to modify sprints for this project."}), 403
        
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]:
        return jsonify({"error": "Invalid sprint status."}), 400
        
    sprint.status = new_status
    db.session.commit()
    return jsonify({
        "message": f"Sprint status updated to {new_status}.",
        "sprint": sprint.to_dict()
    }), 200

@sprints_bp.route("/<string:sprint_id>", methods=["DELETE"])
@jwt_required()
def delete_sprint(sprint_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    if role not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can delete sprints."}), 403
        
    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404

    if not can_access_project(user, role, sprint.project):
        return jsonify({"error": "You do not have permission to delete sprints for this project."}), 403

    Issue.query.filter_by(sprint_id=sprint_id).update({"sprint_id": None})

    db.session.delete(sprint)
    db.session.commit()
    return jsonify({"message": f"Sprint {sprint_id} deleted successfully."}), 200
