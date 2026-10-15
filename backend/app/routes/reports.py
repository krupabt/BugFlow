from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import sqlalchemy as sa
from app.extensions import db
from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

@reports_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_reports():
    project_id = request.args.get("project_id")
    
    base_query = Issue.query
    if project_id and project_id != "All":
        base_query = base_query.filter(Issue.project_id == project_id)
        
    total_issues = base_query.count()
    
    # By Status
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    raw_status = db.session.query(
        Issue.status, sa.func.count(Issue.id)
    )
    if project_id and project_id != "All":
        raw_status = raw_status.filter(Issue.project_id == project_id)
    status_dict = dict(raw_status.group_by(Issue.status).all())
    by_status = [{"status": s, "count": status_dict.get(s, 0)} for s in status_order]
    
    # By Priority
    priority_order = ["P0", "P1", "P2", "P3"]
    raw_priority = db.session.query(
        Issue.priority, sa.func.count(Issue.id)
    )
    if project_id and project_id != "All":
        raw_priority = raw_priority.filter(Issue.project_id == project_id)
    prio_dict = dict(raw_priority.group_by(Issue.priority).all())
    by_priority = [{"priority": p, "count": prio_dict.get(p, 0)} for p in priority_order]
    
    # By Severity
    severity_order = ["Critical", "High", "Medium", "Low"]
    raw_sev = db.session.query(
        Issue.severity, sa.func.count(Issue.id)
    )
    if project_id and project_id != "All":
        raw_sev = raw_sev.filter(Issue.project_id == project_id)
    sev_dict = dict(raw_sev.group_by(Issue.severity).all())
    by_severity = [{"severity": s, "count": sev_dict.get(s, 0)} for s in severity_order]
    
    # By Type
    raw_types = db.session.query(
        Issue.issue_type, sa.func.count(Issue.id)
    )
    if project_id and project_id != "All":
        raw_types = raw_types.filter(Issue.project_id == project_id)
    by_type = [{"type": t or "Unspecified", "count": c} for t, c in raw_types.group_by(Issue.issue_type).all()]
    
    # Project-wise Issues
    raw_projects = db.session.query(
        Project.name, sa.func.count(Issue.id)
    ).join(Issue, Issue.project_id == Project.id).group_by(Project.name).all()
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
    ).filter(Issue.resolution_time_hours.isnot(None))
    if project_id and project_id != "All":
        avg_hours = avg_hours.filter(Issue.project_id == project_id)
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
