from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from app.extensions import db
from app.models.issue import Issue
from app.models.project import Project
from app.models.history import IssueStatusHistory

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required(optional=True)
def get_stats():
    total_issues = Issue.query.count()
    open_issues = Issue.query.filter_by(status="Open").count()
    in_progress = Issue.query.filter_by(status="In Progress").count()
    resolved_issues = Issue.query.filter_by(status="Resolved").count()
    closed_issues = Issue.query.filter_by(status="Closed").count()
    critical_issues = Issue.query.filter(Issue.severity.in_(["Critical", "High"])).count()
    
    # User-assigned issues
    identity = get_jwt_identity()
    user_id = int(identity) if identity else request.args.get("user_id", type=int)
    my_assigned = 0
    if user_id:
        my_assigned = Issue.query.filter_by(assigned_to=user_id).filter(Issue.status.in_(["Open", "In Progress"])).count()
        
    # Breakdown by Status for charts
    status_counts = db.session.query(
        Issue.status, sa.func.count(Issue.id)
    ).group_by(Issue.status).all()
    
    status_chart = [
        {"name": s, "count": c} for s, c in status_counts
    ] if status_counts else [
        {"name": "Open", "count": open_issues},
        {"name": "In Progress", "count": in_progress},
        {"name": "Resolved", "count": resolved_issues},
        {"name": "Closed", "count": closed_issues}
    ]
    
    # Breakdown by Severity for charts
    severity_counts = db.session.query(
        Issue.severity, sa.func.count(Issue.id)
    ).group_by(Issue.severity).all()
    
    severity_order = ["Critical", "High", "Medium", "Low"]
    sev_dict = dict(severity_counts)
    severity_chart = [
        {"severity": s, "count": sev_dict.get(s, 0)} for s in severity_order
    ]
    
    # Breakdown by Project
    project_counts = db.session.query(
        Project.name, sa.func.count(Issue.id)
    ).outerjoin(Issue, Issue.project_id == Project.id).group_by(Project.id).all()
    
    project_chart = [
        {"project": p_name, "count": count} for p_name, count in project_counts
    ]
    
    return jsonify({
        "totals": {
            "total_issues": total_issues,
            "open_issues": open_issues,
            "in_progress_issues": in_progress,
            "resolved_issues": resolved_issues,
            "closed_issues": closed_issues,
            "critical_issues": critical_issues,
            "my_assigned": my_assigned,
            "total_projects": Project.query.count()
        },
        "charts": {
            "by_status": status_chart,
            "by_severity": severity_chart,
            "by_project": project_chart
        }
    }), 200

@dashboard_bp.route("/recent-activity", methods=["GET"])
def get_recent_activity():
    activities = IssueStatusHistory.query.order_by(IssueStatusHistory.created_at.desc()).limit(10).all()
    result = []
    for a in activities:
        result.append({
            "id": a.id,
            "issue_id": a.issue_id,
            "issue_key": a.issue.issue_key if a.issue else f"Issue #{a.issue_id}",
            "issue_title": a.issue.title if a.issue else "Unknown",
            "old_status": a.old_status,
            "new_status": a.new_status,
            "comment": a.comment,
            "changed_by": a.changed_by.name if a.changed_by else "System",
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return jsonify(result), 200
