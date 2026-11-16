from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from extensions import db
from models.issue import Issue
from models.project import Project
from models.user import User
from models.sprint import Sprint
from models.history import IssueStatusHistory
from models.comment import IssueComment
from models.attachment import IssueAttachment

from services.access_control import (
    get_current_user_and_role,
    get_scoped_issues_query,
    get_scoped_projects_query,
    get_managed_project_ids
)

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    identity = get_jwt_identity()
    user, role_raw = get_current_user_and_role(identity)
    if not user:
        return jsonify({"error": "User not found or unauthenticated"}), 401

    user_id = user.id
    scoped_issues = get_scoped_issues_query(user, role_raw)
    scoped_projects = get_scoped_projects_query(user, role_raw)

    # Filter parameters
    project_id = request.args.get("project_id")
    date_range = request.args.get("date_range")
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    today = datetime.now().date()
    start_date = None
    end_date = None

    if date_range == "7d":
        start_date = today - timedelta(days=7)
    elif date_range == "30d":
        start_date = today - timedelta(days=30)
    elif date_range == "90d":
        start_date = today - timedelta(days=90)
    elif date_range in ["year", "this_year"]:
        start_date = date(today.year, 1, 1)
    elif date_range == "custom" or (start_date_str or end_date_str):
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
            except ValueError:
                pass
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
            except ValueError:
                pass

    # Apply project & date filters to scoped issues
    if project_id and project_id != "All":
        scoped_issues = scoped_issues.filter(Issue.project_id == project_id)
    if start_date:
        scoped_issues = scoped_issues.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) >= start_date)
    if end_date:
        scoped_issues = scoped_issues.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) <= end_date)

    # Scoped counts from PostgreSQL
    total_users = User.query.filter_by(active=True).count() if role_raw == "ADMIN" else (db.session.query(sa.func.count(sa.distinct(Issue.assigned_to))).filter(Issue.id.in_(scoped_issues.with_entities(Issue.id))).scalar() or 1)
    total_projects = scoped_projects.count()
    total_issues = scoped_issues.count()
    open_issues = scoped_issues.filter_by(status="Open").count()
    in_progress = scoped_issues.filter_by(status="In Progress").count()
    testing_issues = scoped_issues.filter_by(status="Testing").count()
    resolved_issues = scoped_issues.filter_by(status="Resolved").count()
    closed_issues = scoped_issues.filter_by(status="Closed").count()
    resolved_total = resolved_issues + closed_issues

    # Four Summary Cards for Admin Dashboard (Horizontal row)
    summary_cards = [
        {
            "id": "total",
            "title": "Total Issues",
            "value": total_issues,
            "status_label": "All Tracked Issues",
            "trend": f"Project: {project_id}" if project_id and project_id != "All" else "Across All Projects",
            "color": "#2563EB",
            "bg": "#EFF6FF",
            "border": "#BFDBFE",
            "type": "issues"
        },
        {
            "id": "open",
            "title": "Open Issues",
            "value": open_issues,
            "status_label": "Awaiting Triage",
            "trend": f"{round((open_issues / total_issues * 100), 1) if total_issues else 0}% of active workload",
            "color": "#E97862",
            "bg": "#FDF2F0",
            "border": "#F8C8BE",
            "type": "open"
        },
        {
            "id": "in_progress",
            "title": "In Progress",
            "value": in_progress,
            "status_label": "Active Development",
            "trend": f"{round((in_progress / total_issues * 100), 1) if total_issues else 0}% in progress",
            "color": "#D97706",
            "bg": "#FFF8EB",
            "border": "#FEE3B8",
            "type": "progress"
        },
        {
            "id": "resolved",
            "title": "Resolved Issues",
            "value": resolved_total,
            "status_label": f"{resolved_issues} Resolved • {closed_issues} Closed",
            "trend": f"{round((resolved_total / total_issues * 100), 1) if total_issues else 0}% resolution rate",
            "color": "#16A34A",
            "bg": "#DCFCE7",
            "border": "#BBF7D0",
            "type": "resolved"
        }
    ]

    response_data = {
        "role": user.role_display,
        "internal_role": user.role,
        "user": user.to_dict(),
        "summary_cards": summary_cards,
        "totals": {
            "total_users": total_users,
            "total_projects": total_projects,
            "total_issues": total_issues,
            "open_issues": open_issues,
            "in_progress": in_progress,
            "testing": testing_issues,
            "resolved": resolved_issues,
            "closed": closed_issues,
            "resolved_total": resolved_total
        }
    }

    # Scoped projects for the filter dropdown
    all_scoped_proj = scoped_projects.order_by(Project.name.asc()).all()
    response_data["scoped_projects"] = [
        {"id": str(p.id), "name": p.name, "key": str(p.id)} for p in all_scoped_proj
    ]

    # Current Sprint & Compact Kanban Overview
    selected_sprint_id = request.args.get("sprint_id")
    selected_project_id = request.args.get("project_id")
    target_sprint = None

    scoped_proj_ids = [p.id for p in all_scoped_proj]

    # 1. If explicit sprint_id requested, load it
    if selected_sprint_id and selected_sprint_id != "undefined":
        target_sprint = Sprint.query.filter_by(id=selected_sprint_id).first()

    # 2. Build base sprint query filtered by role permissions
    base_sprint_query = Sprint.query
    if role_raw == "PROJECT_MANAGER":
        base_sprint_query = base_sprint_query.filter(Sprint.project_id.in_(scoped_proj_ids)) if scoped_proj_ids else base_sprint_query.filter(sa.false())
    elif role_raw == "DEVELOPER":
        dev_sprint_ids = [s[0] for s in db.session.query(sa.distinct(Issue.sprint_id)).filter(Issue.assigned_to == user.id, Issue.sprint_id.isnot(None)).all() if s[0]]
        if dev_sprint_ids:
            base_sprint_query = base_sprint_query.filter(Sprint.id.in_(dev_sprint_ids))
        elif scoped_proj_ids:
            base_sprint_query = base_sprint_query.filter(Sprint.project_id.in_(scoped_proj_ids))
    elif role_raw == "TESTER":
        tester_sprint_ids = [s[0] for s in db.session.query(sa.distinct(Issue.sprint_id)).filter((Issue.reported_by == user.id) | (Issue.status == "Testing"), Issue.sprint_id.isnot(None)).all() if s[0]]
        if tester_sprint_ids:
            base_sprint_query = base_sprint_query.filter(Sprint.id.in_(tester_sprint_ids))
        elif scoped_proj_ids:
            base_sprint_query = base_sprint_query.filter(Sprint.project_id.in_(scoped_proj_ids))

    # 3. If a project is selected (from project filter), narrow to that project
    if selected_project_id and selected_project_id != "All":
        base_sprint_query = base_sprint_query.filter(Sprint.project_id == selected_project_id)

    # 4. If no target_sprint yet, find the most logical sprint
    if not target_sprint:
        # Check for ACTIVE sprint first
        target_sprint = base_sprint_query.filter(Sprint.status == "ACTIVE").first()
        if not target_sprint:
            # Pick first sprint with issues, ordered logically by project and start date
            sprint_with_issues = base_sprint_query.join(Issue, Issue.sprint_id == Sprint.id).order_by(Sprint.project_id.asc(), Sprint.start_date.asc(), Sprint.id.asc()).first()
            target_sprint = sprint_with_issues or base_sprint_query.order_by(Sprint.project_id.asc(), Sprint.start_date.asc(), Sprint.id.asc()).first()

    if target_sprint:
        # Accurate calculation from PostgreSQL data
        s_issues = target_sprint.issues.order_by(Issue.id.asc()).all()
        todo_list = [i.to_dict() for i in s_issues if i.status == "Open"]
        progress_list = [i.to_dict() for i in s_issues if i.status == "In Progress"]
        testing_list = [i.to_dict() for i in s_issues if i.status == "Testing"]
        done_list = [i.to_dict() for i in s_issues if i.status in ["Resolved", "Closed"]]

        t_cnt = len(s_issues)
        d_cnt = len(done_list)
        p_cnt = len(progress_list)
        test_cnt = len(testing_list)
        r_cnt = max(0, t_cnt - d_cnt)
        prog_pct = round((d_cnt / t_cnt * 100), 1) if t_cnt > 0 else 0.0

        response_data["current_sprint"] = {
            "id": target_sprint.id,
            "name": target_sprint.name or target_sprint.sprint_name,
            "sprint_name": target_sprint.sprint_name or target_sprint.name,
            "project_id": str(target_sprint.project_id),
            "project_name": target_sprint.project.name if target_sprint.project else "General",
            "status": target_sprint.status,
            "goal": target_sprint.goal or "",
            "start_date": target_sprint.start_date.isoformat() if target_sprint.start_date else None,
            "end_date": target_sprint.end_date.isoformat() if target_sprint.end_date else None,
            "total_issues": t_cnt,
            "completed_issues": d_cnt,
            "in_progress_issues": p_cnt,
            "testing_issues": test_cnt,
            "remaining_issues": r_cnt,
            "progress": prog_pct,
            "kanban": {
                "todo": todo_list,
                "in_progress": progress_list,
                "testing": testing_list,
                "done": done_list
            }
        }
    else:
        response_data["current_sprint"] = None

    # Available sprints for switcher dropdown (ordered logically with clear display names)
    av_sprints_query = Sprint.query
    if role_raw == "PROJECT_MANAGER":
        av_sprints_query = av_sprints_query.filter(Sprint.project_id.in_(scoped_proj_ids)) if scoped_proj_ids else av_sprints_query.filter(sa.false())
    elif role_raw == "DEVELOPER":
        dev_sprint_ids = [s[0] for s in db.session.query(sa.distinct(Issue.sprint_id)).filter(Issue.assigned_to == user.id, Issue.sprint_id.isnot(None)).all() if s[0]]
        if dev_sprint_ids:
            av_sprints_query = av_sprints_query.filter(Sprint.id.in_(dev_sprint_ids))
        elif scoped_proj_ids:
            av_sprints_query = av_sprints_query.filter(Sprint.project_id.in_(scoped_proj_ids))
    elif role_raw == "TESTER":
        tester_sprint_ids = [s[0] for s in db.session.query(sa.distinct(Issue.sprint_id)).filter((Issue.reported_by == user.id) | (Issue.status == "Testing"), Issue.sprint_id.isnot(None)).all() if s[0]]
        if tester_sprint_ids:
            av_sprints_query = av_sprints_query.filter(Sprint.id.in_(tester_sprint_ids))
        elif scoped_proj_ids:
            av_sprints_query = av_sprints_query.filter(Sprint.project_id.in_(scoped_proj_ids))

    all_av_sprints = av_sprints_query.order_by(Sprint.project_id.asc(), Sprint.start_date.asc(), Sprint.id.asc()).all()

    response_data["available_sprints"] = [
        {
            "id": s.id,
            "name": s.name or s.sprint_name,
            "sprint_name": s.sprint_name or s.name,
            "display_name": f"{s.project.name if s.project else 'General'} – {s.name or s.sprint_name} ({s.start_date.strftime('%b %d, %Y') if s.start_date else ''} – {s.end_date.strftime('%b %d, %Y') if s.end_date else ''}) [{s.status}]",
            "project_id": str(s.project_id),
            "project_name": s.project.name if s.project else "General",
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "end_date": s.end_date.isoformat() if s.end_date else None,
            "status": s.status,
            "total_issues": s.issues.count()
        }
        for s in all_av_sprints
    ]

    # Role specific customizations
    if role_raw == "ADMIN":
        response_data["cards"] = summary_cards[:4]
        response_data["primary_stats"] = summary_cards[:4]
        recent_users = User.query.order_by(User.created_at.desc().nullslast(), User.id.asc()).limit(5).all()
        response_data["recent_users"] = [u.to_dict() for u in recent_users]
        admin_sprints = Sprint.query.order_by(Sprint.start_date.desc().nullslast()).limit(6).all()
        response_data["sprints_overview"] = [s.to_dict() for s in admin_sprints]

    elif role_raw == "PROJECT_MANAGER":
        my_project_ids = get_managed_project_ids(user_id)
        my_projects = scoped_projects.all()
        response_data["cards"] = summary_cards[:4]
        response_data["primary_stats"] = summary_cards[:4]
        response_data["my_projects"] = [p.to_dict(include_stats=True) for p in my_projects]

        sprints = Sprint.query.filter(Sprint.project_id.in_(my_project_ids)).order_by(Sprint.start_date.desc().nullslast()).limit(6).all() if my_project_ids else []
        response_data["sprints_overview"] = [s.to_dict() for s in sprints]

        assigned_devs = db.session.query(sa.func.count(sa.distinct(Issue.assigned_to))).filter(
            Issue.project_id.in_(my_project_ids), Issue.assigned_to.isnot(None)
        ).scalar() if my_project_ids else 0
        response_data["assigned_devs_count"] = assigned_devs or 0

    elif role_raw == "DEVELOPER":
        response_data["cards"] = summary_cards[:4]
        response_data["primary_stats"] = summary_cards[:4]
        dev_issues = scoped_issues.order_by(Issue.updated_at.desc().nullslast()).limit(15).all()
        response_data["assigned_issues_list"] = [i.to_dict() for i in dev_issues]

    elif role_raw == "TESTER":
        response_data["cards"] = summary_cards[:4]
        response_data["primary_stats"] = summary_cards[:4]
        testing_list = scoped_issues.filter_by(status="Testing").order_by(Issue.updated_at.desc().nullslast()).limit(10).all()
        response_data["awaiting_testing_list"] = [i.to_dict() for i in testing_list]
        recent_rep = scoped_issues.order_by(Issue.created_date.desc().nullslast(), Issue.created_at.desc().nullslast()).limit(15).all()
        response_data["recent_reported_issues"] = [i.to_dict() for i in recent_rep]

    # Shared Recent Issues
    recent_issues = scoped_issues.order_by(Issue.created_date.desc().nullslast(), Issue.created_at.desc().nullslast()).limit(10).all()
    response_data["recent_issues"] = [i.to_dict() for i in recent_issues]

    # Recent Comments (Role-scoped)
    comments = IssueComment.query.join(
        Issue, IssueComment.issue_id == Issue.id
    ).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).order_by(
        IssueComment.created_at.desc(), IssueComment.id.desc()
    ).limit(6).all()
    response_data["recent_comments"] = [
        {
            "id": c.id,
            "issue_id": str(c.issue_id),
            "issue_title": c.issue.title if c.issue else "",
            "user_name": c.author.name if c.author else "Team Member",
            "author_role": c.author.role if c.author else "Member",
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in comments
    ]

    # Recent Attachments (Role-scoped)
    attachments = IssueAttachment.query.join(
        Issue, IssueAttachment.issue_id == Issue.id
    ).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).order_by(
        IssueAttachment.created_at.desc(), IssueAttachment.id.desc()
    ).limit(6).all()
    response_data["recent_attachments"] = [
        {
            "id": a.id,
            "issue_id": str(a.issue_id),
            "issue_title": a.issue.title if a.issue else "",
            "filename": a.filename,
            "file_size": a.file_size,
            "file_size_formatted": a.format_file_size(a.file_size),
            "content_type": a.content_type,
            "user_name": a.uploader.name if a.uploader else "System",
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in attachments
    ]

    # Status distribution for charts
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    status_color_map = {
        "Open": "#E97862",
        "In Progress": "#D97706",
        "Testing": "#7C3AED",
        "Resolved": "#16A34A",
        "Closed": "#64748B"
    }
    raw_status = db.session.query(Issue.status, sa.func.count(Issue.id)).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).group_by(Issue.status).all()

    s_dict = dict(raw_status)
    total_scoped = sum(s_dict.values())
    response_data["status_distribution"] = [
        {
            "name": s,
            "status": s,
            "count": s_dict.get(s, 0),
            "percentage": round((s_dict.get(s, 0) / total_scoped * 100), 1) if total_scoped > 0 else 0,
            "color": status_color_map.get(s, "#64748B")
        }
        for s in status_order
    ]
    response_data["status_total"] = total_scoped

    # Severity distribution for bar chart
    severity_order = ["Critical", "High", "Medium", "Low"]
    sev_palette = {
        "Critical": "#DC2626",
        "High": "#EA580C",
        "Medium": "#D97706",
        "Low": "#16A34A"
    }
    raw_sev = dict(
        db.session.query(Issue.severity, sa.func.count(Issue.id))
        .filter(Issue.id.in_(scoped_issues.with_entities(Issue.id)))
        .group_by(Issue.severity)
        .all()
    )
    response_data["severity_distribution"] = [
        {
            "severity": sev,
            "count": raw_sev.get(sev, 0),
            "percentage": round((raw_sev.get(sev, 0) / total_issues * 100), 1) if total_issues > 0 else 0.0,
            "color": sev_palette.get(sev, "#64748B")
        }
        for sev in severity_order
    ]

    # Monthly Defect Trend (Created vs Resolved)
    issue_dates = (
        db.session.query(
            Issue.id,
            Issue.status,
            sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)),
            sa.func.coalesce(Issue.resolved_date, Issue.updated_date, sa.cast(Issue.updated_at, sa.Date))
        )
        .filter(Issue.id.in_(scoped_issues.with_entities(Issue.id)))
        .all()
    )

    months_map = {}
    for i_id, i_status, c_dt, r_dt in issue_dates:
        if c_dt:
            m_key = c_dt.strftime("%Y-%m")
            if m_key not in months_map:
                months_map[m_key] = {
                    "month": m_key,
                    "label": c_dt.strftime("%b %Y"),
                    "created": 0,
                    "resolved": 0
                }
            months_map[m_key]["created"] += 1
        
        if i_status in ["Resolved", "Closed"] and r_dt:
            m_key = r_dt.strftime("%Y-%m")
            if m_key not in months_map:
                months_map[m_key] = {
                    "month": m_key,
                    "label": r_dt.strftime("%b %Y"),
                    "created": 0,
                    "resolved": 0
                }
            months_map[m_key]["resolved"] += 1

    sorted_trend = [months_map[k] for k in sorted(months_map.keys())]
    if not sorted_trend:
        curr = date.today()
        sorted_trend = [{
            "month": curr.strftime("%Y-%m"),
            "label": curr.strftime("%b %Y"),
            "created": 0,
            "resolved": 0
        }]
    response_data["monthly_defect_trend"] = sorted_trend

    # Quality Metrics
    avg_hours_val = (
        db.session.query(sa.func.avg(Issue.resolution_time_hours))
        .filter(
            Issue.id.in_(scoped_issues.with_entities(Issue.id)),
            Issue.status.in_(["Resolved", "Closed"]),
            Issue.resolution_time_hours.isnot(None),
            Issue.resolution_time_hours > 0
        )
        .scalar()
    )
    if avg_hours_val:
        avg_hours = round(float(avg_hours_val), 1)
        avg_days = round(avg_hours / 24.0, 1)
    else:
        avg_hours = 0.0
        avg_days = 0.0

    resolution_rate = round((resolved_total / total_issues * 100), 1) if total_issues > 0 else 0.0
    total_pending = open_issues + in_progress + testing_issues

    response_data["quality_metrics"] = {
        "average_resolution_time": {
            "hours": avg_hours,
            "days": avg_days,
            "display": f"{avg_hours} hrs" if avg_hours < 48 else f"{avg_days} days"
        },
        "resolution_rate": {
            "percentage": resolution_rate,
            "display": f"{resolution_rate}%"
        },
        "total_pending_issues": total_pending,
        "defect_density": {
            "status": "unavailable",
            "value": None,
            "message": "Data unavailable. Project size (KLOC) metric is required to calculate defect density."
        }
    }

    # Top Modules by Defects
    top_modules_raw = (
        db.session.query(
            sa.func.coalesce(Issue.affected_module, Issue.component, "General").label("module_name"),
            sa.func.count(Issue.id).label("issue_count")
        )
        .filter(Issue.id.in_(scoped_issues.with_entities(Issue.id)))
        .group_by("module_name")
        .order_by(sa.desc("issue_count"))
        .limit(6)
        .all()
    )
    response_data["top_modules"] = [
        {
            "module": row[0] or "General",
            "count": row[1],
            "percentage": round((row[1] / total_issues * 100), 1) if total_issues > 0 else 0.0
        }
        for row in top_modules_raw
    ]

    # Recent Activity for Admin & scoped views
    recent_act_query = IssueStatusHistory.query
    if role_raw not in ["ADMIN", "ADMINISTRATOR"]:
        recent_act_query = recent_act_query.join(
            Issue, IssueStatusHistory.issue_id == Issue.id
        ).filter(
            Issue.id.in_(scoped_issues.with_entities(Issue.id))
        )
    recent_acts = recent_act_query.order_by(IssueStatusHistory.created_at.desc(), IssueStatusHistory.id.desc()).limit(8).all()
    response_data["recent_activity"] = [a.to_dict() for a in recent_acts]

    # Project-wise issue count
    project_counts = db.session.query(
        Project.name, sa.func.count(Issue.id)
    ).join(Issue, Issue.project_id == Project.id).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).group_by(Project.name).all()
    response_data["project_issue_counts"] = [
        {"project": p, "count": c} for p, c in project_counts
    ]

    return jsonify(response_data), 200

@dashboard_bp.route("/recent-activity", methods=["GET"])
@jwt_required()
def get_recent_activity():
    identity = get_jwt_identity()
    user, role = get_current_user_and_role(identity)
    if not user:
        return jsonify({"error": "User not authenticated"}), 401

    limit = request.args.get("limit", default=10, type=int)
    if request.args.get("all", "").lower() in ["true", "1"]:
        limit = 100

    scoped_issues = get_scoped_issues_query(user, role)

    if role in ["ADMIN", "ADMINISTRATOR"]:
        query = IssueStatusHistory.query
    else:
        query = IssueStatusHistory.query.join(
            Issue, IssueStatusHistory.issue_id == Issue.id
        ).filter(
            Issue.id.in_(scoped_issues.with_entities(Issue.id))
        )

    activities = query.order_by(IssueStatusHistory.created_at.desc(), IssueStatusHistory.id.desc()).limit(limit).all()
    result = [a.to_dict() for a in activities]
    return jsonify(result), 200

@dashboard_bp.route("/recent-comments", methods=["GET"])
@jwt_required()
def get_recent_comments():
    identity = get_jwt_identity()
    user, role = get_current_user_and_role(identity)
    if not user:
        return jsonify({"error": "User not authenticated"}), 401

    limit = request.args.get("limit", default=10, type=int)
    scoped_issues = get_scoped_issues_query(user, role)

    comments = IssueComment.query.join(
        Issue, IssueComment.issue_id == Issue.id
    ).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).order_by(
        IssueComment.created_at.desc(), IssueComment.id.desc()
    ).limit(limit).all()

    result = [
        {
            "id": c.id,
            "issue_id": str(c.issue_id),
            "issue_title": c.issue.title if c.issue else "",
            "user_name": c.author.name if c.author else "Team Member",
            "author_role": c.author.role if c.author else "Member",
            "content": c.content,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in comments
    ]
    return jsonify(result), 200

@dashboard_bp.route("/recent-attachments", methods=["GET"])
@jwt_required()
def get_recent_attachments():
    identity = get_jwt_identity()
    user, role = get_current_user_and_role(identity)
    if not user:
        return jsonify({"error": "User not authenticated"}), 401

    limit = request.args.get("limit", default=10, type=int)
    scoped_issues = get_scoped_issues_query(user, role)

    attachments = IssueAttachment.query.join(
        Issue, IssueAttachment.issue_id == Issue.id
    ).filter(
        Issue.id.in_(scoped_issues.with_entities(Issue.id))
    ).order_by(
        IssueAttachment.created_at.desc(), IssueAttachment.id.desc()
    ).limit(limit).all()

    result = [
        {
            "id": a.id,
            "issue_id": str(a.issue_id),
            "issue_title": a.issue.title if a.issue else "",
            "filename": a.filename,
            "file_size": a.file_size,
            "file_size_formatted": a.format_file_size(a.file_size),
            "content_type": a.content_type,
            "user_name": a.uploader.name if a.uploader else "System",
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in attachments
    ]
    return jsonify(result), 200
