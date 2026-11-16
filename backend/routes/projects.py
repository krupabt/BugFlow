from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from extensions import db
from models.project import Project, project_members
from models.user import User
from models.sprint import Sprint
from models.sprint import Sprint
from models.issue import Issue
from services.access_control import (
    get_current_user_and_role,
    get_scoped_projects_query,
    can_access_project
)

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

@projects_bp.route("", methods=["GET"])
@jwt_required()
def get_projects():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    include_stats = request.args.get("include_stats", "true").lower() == "true"
    pm_id = request.args.get("project_manager_id")
    status = request.args.get("status")
    
    query = get_scoped_projects_query(user, role)
    if pm_id and pm_id != "All":
        query = query.filter(Project.project_manager_id == pm_id)
    if status and status != "All":
        query = query.filter(Project.lifecycle_status == status)
        
    projects = query.order_by(Project.id.asc()).all()
    result = []
    for p in projects:
        d = p.to_dict(include_stats=include_stats)
        if role == "DEVELOPER":
            d["my_assigned_issues"] = Issue.query.filter_by(project_id=p.id, assigned_to=user.id).count()
            d["my_completed_issues"] = Issue.query.filter_by(project_id=p.id, assigned_to=user.id).filter(Issue.status.in_(["Resolved", "Closed"])).count()
        elif role == "TESTER":
            d["my_reported_issues"] = Issue.query.filter_by(project_id=p.id).filter(
                (Issue.reported_by == user.id) | (Issue.created_by == user.id)
            ).count()
            d["my_verification_issues"] = Issue.query.filter_by(project_id=p.id, status="Testing").count()
        result.append(d)
    return jsonify(result), 200

@projects_bp.route("/<string:project_id>", methods=["GET"])
@jwt_required()
def get_project(project_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    if not can_access_project(user, role, project):
        return jsonify({"error": "You do not have permission to access this project."}), 403
        
    data = project.to_dict(include_stats=True)
    data["members"] = [m.to_dict() for m in project.members]
    
    # Scope issues returned inside project details to user's permissions
    issues_q = project.issues
    if role == "DEVELOPER":
        issues_q = issues_q.filter(Issue.assigned_to == user.id)
        data["my_assigned_issues"] = Issue.query.filter_by(project_id=project.id, assigned_to=user.id).count()
        data["my_completed_issues"] = Issue.query.filter_by(project_id=project.id, assigned_to=user.id).filter(Issue.status.in_(["Resolved", "Closed"])).count()
    elif role == "TESTER":
        issues_q = issues_q.filter((Issue.reported_by == user.id) | (Issue.created_by == user.id) | (Issue.status == "Testing"))
        data["my_reported_issues"] = Issue.query.filter_by(project_id=project.id).filter(
            (Issue.reported_by == user.id) | (Issue.created_by == user.id)
        ).count()
        data["my_verification_issues"] = Issue.query.filter_by(project_id=project.id, status="Testing").count()

    data["issues"] = [i.to_dict() for i in issues_q.order_by(Issue.created_date.desc().nullslast(), Issue.created_at.desc().nullslast()).limit(50)]
    data["sprints"] = [s.to_dict() for s in Sprint.query.filter_by(project_id=project_id).all()]
    return jsonify(data), 200

@projects_bp.route("/<string:project_id>/issues", methods=["GET"])
@jwt_required()
def get_project_issues(project_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    if not can_access_project(user, role, project):
        return jsonify({"success": False, "error": "You do not have permission to access this project."}), 403

    query = Issue.query.filter_by(project_id=project.id)
    if role == "DEVELOPER":
        query = query.filter(Issue.assigned_to == user.id)
    elif role == "TESTER":
        query = query.filter(
            (Issue.reported_by == user.id) | 
            (Issue.created_by == user.id) | 
            (Issue.status == "Testing")
        )

    status = request.args.get("status")
    severity = request.args.get("severity")
    priority = request.args.get("priority")
    issue_type = request.args.get("issue_type")
    q = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)

    if status and status != "All":
        query = query.filter(Issue.status == status)
    if severity and severity != "All":
        query = query.filter(Issue.severity == severity)
    if priority and priority != "All":
        query = query.filter(Issue.priority.ilike(f"%{priority}%"))
    if issue_type and issue_type != "All":
        query = query.filter(Issue.issue_type == issue_type)
    if q:
        query = query.filter(
            (Issue.title.ilike(f"%{q}%")) |
            (Issue.description.ilike(f"%{q}%")) |
            (Issue.id.ilike(f"%{q}%"))
        )

    total = query.count()
    issues = query.order_by(Issue.created_date.desc().nullslast(), Issue.id.desc()).offset((page - 1) * per_page).limit(per_page).all()
    issues_list = [i.to_dict(include_details=False) for i in issues]

    return jsonify({
        "success": True,
        "message": f"Issues for project '{project.name}' retrieved successfully",
        "project_id": project.id,
        "project_name": project.name,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "issues": issues_list,
        "data": {
            "project_id": project.id,
            "project_name": project.name,
            "total": total,
            "issues": issues_list
        }
    }), 200

@projects_bp.route("", methods=["POST"])
@jwt_required()
def create_project():
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    role_raw = (user.role or "").strip().upper().replace(" ", "_") if (user and user.role) else ""
    if role_raw not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can create projects."}), 403

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    pm_id = data.get("project_manager_id") or (user.id if role_raw == "PROJECT_MANAGER" else None)
    
    if not name:
        return jsonify({"error": "Project name is required"}), 400
        
    # Concurrency-safe sequential Project ID: PRJ-xxx
    import sqlalchemy as sa
    max_num = db.session.query(
        sa.func.max(sa.cast(sa.func.nullif(sa.func.regexp_replace(Project.id, r'[^0-9]', '', 'g'), ''), sa.BigInteger))
    ).filter(Project.id.ilike('PRJ-%')).scalar() or 0
    next_num = max_num + 1
    new_pid = f"PRJ-{next_num:03d}"
    while db.session.get(Project, new_pid):
        next_num += 1
        new_pid = f"PRJ-{next_num:03d}"

    project = Project(
        id=new_pid,
        name=name,
        description=description,
        project_manager_id=pm_id,
        lifecycle_status="ACTIVE",
        created_date=datetime.now().date()
    )
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        "message": "Project created successfully",
        "project": project.to_dict(include_stats=True)
    }), 201

@projects_bp.route("/<string:project_id>", methods=["PUT"])
@jwt_required()
def update_project(project_id):
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    role_raw = (user.role or "").strip().upper().replace(" ", "_") if (user and user.role) else ""
    if role_raw not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can edit projects."}), 403

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    if role_raw == "PROJECT_MANAGER" and project.project_manager_id != user.id:
        return jsonify({"error": "You can only edit projects assigned to you."}), 403

    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        project.name = data["name"].strip()
    if "description" in data:
        project.description = data["description"].strip()
    if "project_manager_id" in data:
        project.project_manager_id = data["project_manager_id"]
    if "lifecycle_status" in data:
        project.lifecycle_status = data["lifecycle_status"]
        
    db.session.commit()
    return jsonify({
        "message": "Project updated successfully",
        "project": project.to_dict(include_stats=True)
    }), 200

@projects_bp.route("/<string:project_id>/members", methods=["POST"])
@jwt_required()
def assign_member(project_id):
    ident = get_jwt_identity()
    user_req, role_raw = get_current_user_and_role(ident)
    if not user_req:
        return jsonify({"error": "Authentication required"}), 401
    if role_raw not in ["ADMIN", "PROJECT_MANAGER"]:
        return jsonify({"error": "Only Admins and Project Managers can assign members."}), 403

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    if not can_access_project(user_req, role_raw, project):
        return jsonify({"error": "You do not have permission to modify this project."}), 403
        
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
        
    user = db.session.get(User, str(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user not in project.members:
        project.members.append(user)
        db.session.commit()
        
    return jsonify({
        "message": f"User '{user.name}' assigned to project '{project.name}'",
        "members": [m.to_dict() for m in project.members]
    }), 200
