from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from app.extensions import db
from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User
from app.models.sprint import Sprint
from app.models.history import IssueStatusHistory

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    identity = get_jwt_identity()
    user = db.session.get(User, str(identity)) if identity else None
    if not user:
        return jsonify({"error": "User not found or unauthenticated"}), 401

    # Security: Strictly derive role and user_id from verified JWT identity
    role_raw = (user.role or "").strip().upper().replace(" ", "_")
    user_id = user.id

    # Global counts from PostgreSQL
    total_users = User.query.filter_by(active=True).count()
    total_projects = Project.query.count()
    total_issues = Issue.query.count()
    open_issues = Issue.query.filter_by(status="Open").count()
    in_progress = Issue.query.filter_by(status="In Progress").count()
    testing_issues = Issue.query.filter_by(status="Testing").count()
    resolved_issues = Issue.query.filter_by(status="Resolved").count()
    closed_issues = Issue.query.filter_by(status="Closed").count()

    response_data = {
        "role": user.role_display,
        "internal_role": user.role,
        "user": user.to_dict(),
        "totals": {
            "total_users": total_users,
            "total_projects": total_projects,
            "total_issues": total_issues,
            "open_issues": open_issues,
            "in_progress": in_progress,
            "testing": testing_issues,
            "resolved": resolved_issues,
            "closed": closed_issues
        }
    }

    # Role specific customizations
    if role_raw == "ADMIN":
        response_data["cards"] = [
            {"title": "Total Users", "value": total_users, "trend": "Active Team Accounts", "type": "users"},
            {"title": "Total Projects", "value": total_projects, "trend": "Under Management", "type": "projects"},
            {"title": "Total Issues", "value": total_issues, "trend": "Recorded in System", "type": "issues"},
            {"title": "Open Issues", "value": open_issues, "trend": "Awaiting Triage", "type": "open"},
        ]
        # Recent users
        recent_users = User.query.order_by(User.created_at.desc().nullslast(), User.id.asc()).limit(5).all()
        response_data["recent_users"] = [u.to_dict() for u in recent_users]

    elif role_raw == "PROJECT_MANAGER":
        my_projects = Project.query.filter_by(project_manager_id=user_id).all()
        my_project_ids = [p.id for p in my_projects]
        
        pm_issues_query = Issue.query.filter(Issue.project_id.in_(my_project_ids)) if my_project_ids else Issue.query
        pm_total = pm_issues_query.count()
        pm_open = pm_issues_query.filter_by(status="Open").count()
        pm_in_progress = pm_issues_query.filter_by(status="In Progress").count()
        
        response_data["cards"] = [
            {"title": "My Projects", "value": len(my_projects), "trend": "Managed Projects", "type": "projects"},
            {"title": "Total Issues", "value": pm_total, "trend": "Across My Projects", "type": "issues"},
            {"title": "Open Issues", "value": pm_open, "trend": "Awaiting Assignment", "type": "open"},
            {"title": "In Progress", "value": pm_in_progress, "trend": "Active Development", "type": "progress"},
        ]
        response_data["my_projects"] = [p.to_dict(include_stats=True) for p in my_projects]

        # Sprints overview
        sprints = Sprint.query.filter(Sprint.project_id.in_(my_project_ids)).order_by(Sprint.start_date.desc().nullslast()).limit(6).all() if my_project_ids else Sprint.query.limit(6).all()
        response_data["sprints_overview"] = [s.to_dict() for s in sprints]

        # Assigned Developers count
        assigned_devs = db.session.query(sa.func.count(sa.distinct(Issue.assigned_to))).filter(
            Issue.project_id.in_(my_project_ids), Issue.assigned_to.isnot(None)
        ).scalar() if my_project_ids else 0
        response_data["assigned_devs_count"] = assigned_devs or 0

    elif role_raw == "DEVELOPER":
        dev_assigned = Issue.query.filter_by(assigned_to=user_id)
        my_total = dev_assigned.count()
        my_progress = dev_assigned.filter_by(status="In Progress").count()
        my_resolved = dev_assigned.filter_by(status="Resolved").count()
        my_closed = dev_assigned.filter_by(status="Closed").count()

        response_data["cards"] = [
            {"title": "Assigned Issues", "value": my_total, "trend": "Assigned to You", "type": "issues"},
            {"title": "In Progress", "value": my_progress, "trend": "Under Fix", "type": "progress"},
            {"title": "Resolved", "value": my_resolved, "trend": "Pending Verification", "type": "resolved"},
            {"title": "Closed", "value": my_closed, "trend": "Verified & Closed", "type": "closed"},
        ]
        # Developer issues list
        dev_issues = dev_assigned.order_by(Issue.updated_at.desc().nullslast()).limit(15).all()
        response_data["assigned_issues_list"] = [i.to_dict() for i in dev_issues]

    elif role_raw == "TESTER":
        reported_q = Issue.query.filter((Issue.reported_by == user_id) | (Issue.created_by == user_id))
        rep_total = reported_q.count()
        rep_testing = Issue.query.filter_by(status="Testing").count()
        rep_resolved = reported_q.filter_by(status="Resolved").count()
        rep_closed = reported_q.filter_by(status="Closed").count()

        response_data["cards"] = [
            {"title": "Reported Issues", "value": rep_total, "trend": "Reported by You", "type": "issues"},
            {"title": "Testing", "value": rep_testing, "trend": "Awaiting Verification", "type": "testing"},
            {"title": "Resolved", "value": rep_resolved, "trend": "Fixes Completed", "type": "resolved"},
            {"title": "Closed", "value": rep_closed, "trend": "Verified & Closed", "type": "closed"},
        ]
        # Issues awaiting testing
        testing_list = Issue.query.filter_by(status="Testing").order_by(Issue.updated_at.desc().nullslast()).limit(10).all()
        response_data["awaiting_testing_list"] = [i.to_dict() for i in testing_list]

    # Shared Recent Issues
    recent_issues = Issue.query.order_by(Issue.created_date.desc().nullslast(), Issue.created_at.desc().nullslast()).limit(8).all()
    response_data["recent_issues"] = [i.to_dict() for i in recent_issues]

    # Status distribution for charts
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    raw_status = db.session.query(Issue.status, sa.func.count(Issue.id)).group_by(Issue.status).all()
    s_dict = dict(raw_status)
    response_data["status_distribution"] = [
        {"name": s, "count": s_dict.get(s, 0)} for s in status_order
    ]

    # Project-wise issue count
    project_counts = db.session.query(
        Project.name, sa.func.count(Issue.id)
    ).join(Issue, Issue.project_id == Project.id).group_by(Project.name).all()
    response_data["project_issue_counts"] = [
        {"project": p, "count": c} for p, c in project_counts
    ]

    return jsonify(response_data), 200

@dashboard_bp.route("/recent-activity", methods=["GET"])
@jwt_required()
def get_recent_activity():
    activities = IssueStatusHistory.query.order_by(IssueStatusHistory.created_at.desc()).limit(15).all()
    result = []
    for a in activities:
        result.append(a.to_dict())
    return jsonify(result), 200
