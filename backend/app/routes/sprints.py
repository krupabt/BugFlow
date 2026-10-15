from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models.sprint import Sprint
from app.models.project import Project
from app.models.user import User

sprints_bp = Blueprint("sprints", __name__, url_prefix="/api/sprints")

@sprints_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_sprints():
    project_id = request.args.get("project_id")
    status = request.args.get("status")
    
    query = Sprint.query
    if project_id and project_id != "All":
        query = query.filter(Sprint.project_id == project_id)
    if status and status != "All":
        query = query.filter(Sprint.status == status)
        
    sprints = query.order_by(Sprint.start_date.desc().nullslast()).all()
    return jsonify([s.to_dict() for s in sprints]), 200

@sprints_bp.route("/<string:sprint_id>", methods=["GET"])
@jwt_required(optional=True)
def get_sprint(sprint_id):
    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404
    return jsonify(sprint.to_dict(include_issues=True)), 200

@sprints_bp.route("", methods=["POST"])
@jwt_required()
def create_sprint():
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    if not user or user.role not in ["Admin", "Project Manager"]:
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

    # Generate sprint ID
    sp_count = Sprint.query.filter_by(project_id=project_id).count()
    clean_p_num = project_id.replace("PRJ-", "")
    new_sp_id = f"SP-{clean_p_num}-{sp_count + 1:02d}"
    while db.session.get(Sprint, new_sp_id):
        sp_count += 1
        new_sp_id = f"SP-{clean_p_num}-{sp_count + 1:02d}"

    def parse_d(d):
        if not d:
            return None
        try:
            return datetime.strptime(d[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    sprint = Sprint(
        id=new_sp_id,
        project_id=project_id,
        name=name,
        sprint_name=name,
        goal=goal,
        start_date=parse_d(start_date_str),
        end_date=parse_d(end_date_str),
        status="PLANNED",
        created_by=user.id if user else None
    )
    db.session.add(sprint)
    db.session.commit()
    
    return jsonify({
        "message": "Sprint created successfully.",
        "sprint": sprint.to_dict()
    }), 201

@sprints_bp.route("/<string:sprint_id>/status", methods=["PATCH"])
@jwt_required()
def update_sprint_status(sprint_id):
    ident = get_jwt_identity()
    user = db.session.get(User, str(ident)) if ident else None
    if not user or user.role not in ["Admin", "Project Manager"]:
        return jsonify({"error": "Only Admins and Project Managers can update sprint status."}), 403
        
    sprint = db.session.get(Sprint, sprint_id)
    if not sprint:
        return jsonify({"error": "Sprint not found"}), 404
        
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
