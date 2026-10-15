from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models.project import Project, project_members
from app.models.user import User
from app.models.sprint import Sprint

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

@projects_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_projects():
    include_stats = request.args.get("include_stats", "true").lower() == "true"
    pm_id = request.args.get("project_manager_id")
    status = request.args.get("status")
    
    query = Project.query
    if pm_id and pm_id != "All":
        query = query.filter(Project.project_manager_id == pm_id)
    if status and status != "All":
        query = query.filter(Project.lifecycle_status == status)
        
    projects = query.order_by(Project.id.asc()).all()
    return jsonify([p.to_dict(include_stats=include_stats) for p in projects]), 200

@projects_bp.route("/<string:project_id>", methods=["GET"])
@jwt_required(optional=True)
def get_project(project_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    data = project.to_dict(include_stats=True)
    data["members"] = [m.to_dict() for m in project.members]
    data["issues"] = [i.to_dict() for i in project.issues.order_by(Project.created_at.desc().nullslast()).limit(50)]
    data["sprints"] = [s.to_dict() for s in Sprint.query.filter_by(project_id=project_id).all()]
    return jsonify(data), 200

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
        
    # Generate unique Project ID
    p_count = Project.query.count()
    new_pid = f"PRJ-{p_count + 1:03d}"
    while db.session.get(Project, new_pid):
        p_count += 1
        new_pid = f"PRJ-{p_count + 1:03d}"

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
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
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
