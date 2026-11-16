from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from extensions import db
from models.issue import Issue
from models.project import Project
from models.user import User
from services.access_control import (
    get_current_user_and_role,
    get_scoped_issues_query,
    can_access_project
)

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

@reports_bp.route("", methods=["GET"])
@jwt_required()
def get_reports():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    project_id = request.args.get("project_id")
    
    # Base scoped query by user role
    base_query = get_scoped_issues_query(user, role)

    if project_id and project_id != "All":
        project = db.session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        if not can_access_project(user, role, project):
            return jsonify({"error": "You do not have permission to view reports for this project."}), 403
        base_query = base_query.filter(Issue.project_id == project_id)
        
    total_issues = base_query.count()
    scoped_ids = base_query.with_entities(Issue.id)
    
    # By Status
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    raw_status = db.session.query(
        Issue.status, sa.func.count(Issue.id)
    ).filter(Issue.id.in_(scoped_ids))
    status_dict = dict(raw_status.group_by(Issue.status).all())
    by_status = [{"status": s, "count": status_dict.get(s, 0)} for s in status_order]
    
    # By Priority
    priority_order = ["P0", "P1", "P2", "P3"]
    raw_priority = db.session.query(
        Issue.priority, sa.func.count(Issue.id)
    ).filter(Issue.id.in_(scoped_ids))
    prio_dict = dict(raw_priority.group_by(Issue.priority).all())
    by_priority = [{"priority": p, "count": prio_dict.get(p, 0)} for p in priority_order]
    
    # By Severity
    severity_order = ["Critical", "High", "Medium", "Low"]
    raw_sev = db.session.query(
        Issue.severity, sa.func.count(Issue.id)
    ).filter(Issue.id.in_(scoped_ids))
    sev_dict = dict(raw_sev.group_by(Issue.severity).all())
    by_severity = [{"severity": s, "count": sev_dict.get(s, 0)} for s in severity_order]
    
    # By Type
    raw_types = db.session.query(
        Issue.issue_type, sa.func.count(Issue.id)
    ).filter(Issue.id.in_(scoped_ids))
    by_type = [{"type": t or "Unspecified", "count": c} for t, c in raw_types.group_by(Issue.issue_type).all()]
    
    # Project-wise Issues
    raw_projects = db.session.query(
        Project.name, sa.func.count(Issue.id)
    ).join(Issue, Issue.project_id == Project.id).filter(
        Issue.id.in_(scoped_ids)
    ).group_by(Project.name).all()
    project_wise = [{"project": p, "count": c} for p, c in raw_projects]
    
    # Resolved vs Unresolved
    resolved_count = base_query.filter(Issue.status.in_(["Resolved", "Closed"])).count()
    unresolved_count = total_issues - resolved_count
    resolved_vs_unresolved = [
        {"name": "Resolved / Closed", "count": resolved_count, "color": "#16A34A"},
        {"name": "Active / Unresolved", "count": unresolved_count, "color": "#6754E8"}
    ]
    
    # Average Resolution Time in Hours
    avg_hours = db.session.query(
        sa.func.avg(Issue.resolution_time_hours)
    ).filter(
        Issue.id.in_(scoped_ids),
        Issue.resolution_time_hours.isnot(None)
    )
    avg_hours_val = avg_hours.scalar()
    avg_resolution_hours = round(float(avg_hours_val), 1) if avg_hours_val else 0.0
    
    # Reopen metrics
    reopened_count = base_query.filter(Issue.reopen_count > 0).count()

    return jsonify({
        "total_issues": total_issues,
        "resolved_issues": resolved_count,
        "unresolved_issues": unresolved_count,
        "resolution_rate": round((resolved_count / total_issues * 100), 1) if total_issues > 0 else 0.0,
        "avg_resolution_hours": avg_resolution_hours,
        "reopened_issues": reopened_count,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_severity": by_severity,
        "by_type": by_type,
        "project_wise": project_wise,
        "resolved_vs_unresolved": resolved_vs_unresolved
    }), 200
