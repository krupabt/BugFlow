from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.project import Project, project_members
from app.models.user import User

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

@projects_bp.route("", methods=["GET"])
def get_projects():
    include_stats = request.args.get("include_stats", "true").lower() == "true"
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict(include_stats=include_stats) for p in projects]), 200

@projects_bp.route("/<int:project_id>", methods=["GET"])
def get_project(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    data = project.to_dict(include_stats=True)
    data["members"] = [m.to_dict() for m in project.members]
    data["issues"] = [i.to_dict() for i in project.issues.order_by(Project.created_at.desc()).limit(50)]
    return jsonify(data), 200

@projects_bp.route("", methods=["POST"])
@jwt_required(optional=True)
def create_project():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    
    if not name:
        return jsonify({"error": "Project name is required"}), 400
        
    project = Project(name=name, description=description)
    db.session.add(project)
    db.session.commit()
    
    return jsonify({
        "message": "Project created successfully",
        "project": project.to_dict(include_stats=True)
    }), 201

@projects_bp.route("/<int:project_id>/members", methods=["POST"])
@jwt_required(optional=True)
def assign_member(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user not in project.members:
        project.members.append(user)
        db.session.commit()
        
    return jsonify({
        "message": f"User '{user.name}' assigned to project '{project.name}'",
        "members": [m.to_dict() for m in project.members]
    }), 200
