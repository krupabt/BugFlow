from datetime import datetime, date, timedelta
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
    get_scoped_projects_query,
    can_access_project
)

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")

STATUS_PALETTE = {
    "Open": "#E97862",
    "In Progress": "#D97706",
    "Testing": "#5B4870",
    "Resolved": "#2B6647",
    "Closed": "#817B86"
}

SEVERITY_PALETTE = {
    "Critical": "#B91C1C",
    "High": "#C2410C",
    "Medium": "#D97706",
    "Low": "#2B6647"
}

def build_project_analytics(project, user, role, start_date=None, end_date=None):
    # Base scoped issues for this project
    base_query = Issue.query.filter_by(project_id=project.id)
    if role == "DEVELOPER":
        base_query = base_query.filter(Issue.assigned_to == user.id)
    elif role == "TESTER":
        base_query = base_query.filter(
            (Issue.reported_by == user.id) | 
            (Issue.created_by == user.id) | 
            (Issue.status == "Testing")
        )

    # Date range filters on creation date
    if start_date:
        base_query = base_query.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) >= start_date)
    if end_date:
        base_query = base_query.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) <= end_date)

    total_issues = base_query.count()
    open_count = base_query.filter(Issue.status == "Open").count()
    in_prog_count = base_query.filter(Issue.status == "In Progress").count()
    testing_count = base_query.filter(Issue.status == "Testing").count()
    resolved_count = base_query.filter(Issue.status == "Resolved").count()
    closed_count = base_query.filter(Issue.status == "Closed").count()
    total_resolved = resolved_count + closed_count

    # 1. Status Distribution (Donut Chart)
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    status_counts = {
        "Open": open_count,
        "In Progress": in_prog_count,
        "Testing": testing_count,
        "Resolved": resolved_count,
        "Closed": closed_count
    }
    status_distribution = []
    for s in status_order:
        cnt = status_counts[s]
        pct = round((cnt / total_issues * 100), 1) if total_issues > 0 else 0.0
        status_distribution.append({
            "status": s,
            "count": cnt,
            "percentage": pct,
            "color": STATUS_PALETTE.get(s, "#817B86")
        })

    # 2. Defect Trend Analysis (Monthly Line Chart: Created vs Resolved)
    # Query all issues in project to aggregate monthly
    all_project_issues = base_query.all()
    months_map = {}
    
    for iss in all_project_issues:
        c_dt = iss.created_date or (iss.created_at.date() if iss.created_at else None)
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

        if iss.status in ["Resolved", "Closed"]:
            r_dt = iss.resolved_date or (iss.updated_date if iss.status in ["Resolved", "Closed"] else None) or c_dt
            if r_dt:
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
        # Default placeholder month if project has no issues yet
        curr = date.today()
        sorted_trend = [{
            "month": curr.strftime("%Y-%m"),
            "label": curr.strftime("%b %Y"),
            "created": 0,
            "resolved": 0
        }]

    # 3. Severity Distribution (Bar Chart)
    severity_order = ["Critical", "High", "Medium", "Low"]
    raw_sev = dict(
        base_query.with_entities(Issue.severity, sa.func.count(Issue.id))
        .group_by(Issue.severity)
        .all()
    )
    severity_distribution = []
    for sev in severity_order:
        cnt = raw_sev.get(sev, 0)
        pct = round((cnt / total_issues * 100), 1) if total_issues > 0 else 0.0
        severity_distribution.append({
            "severity": sev,
            "count": cnt,
            "percentage": pct,
            "color": SEVERITY_PALETTE.get(sev, "#817B86")
        })

    # 4. Key Software Quality Metrics
    # A. Average Resolution Time
    resolved_issues_list = [i for i in all_project_issues if i.status in ["Resolved", "Closed"]]
    duration_hours = []
    for r_iss in resolved_issues_list:
        if r_iss.resolution_time_hours is not None and float(r_iss.resolution_time_hours) > 0:
            duration_hours.append(float(r_iss.resolution_time_hours))
        elif r_iss.created_date and r_iss.resolved_date:
            diff = (r_iss.resolved_date - r_iss.created_date).days * 24.0
            duration_hours.append(max(diff, 2.0))

    if duration_hours:
        avg_hours = round(sum(duration_hours) / len(duration_hours), 1)
        avg_days = round(avg_hours / 24.0, 1)
    else:
        avg_hours = 0.0
        avg_days = 0.0

    # B. Resolution Rate
    resolution_rate = round((total_resolved / total_issues * 100), 1) if total_issues > 0 else 0.0

    # C. Defect Density (Explicitly data unavailable if KLOC not recorded)
    defect_density = {
        "status": "unavailable",
        "value": None,
        "unit": "defects/KLOC",
        "message": "Data unavailable. Project source size (KLOC) metric is required to calculate defect density."
    }

    # 5. Dynamic Project Quality Insights
    crit_high_count = raw_sev.get("Critical", 0) + raw_sev.get("High", 0)
    active_backlog = open_count + in_prog_count
    
    if total_issues == 0:
        insight = {
            "health": "No Data",
            "health_color": "#817B86",
            "risk_level": "Unknown",
            "score": 0,
            "headline": "Insufficient Issue Data",
            "summary": "This project currently has no recorded issues or defect activity to evaluate.",
            "recommendation": "Begin logging issues or assign sprints to initiate quality benchmarking."
        }
    elif resolution_rate >= 70.0 and crit_high_count <= 5:
        score = min(100, int(75 + (resolution_rate - 70) * 0.8))
        insight = {
            "health": "Optimal",
            "health_color": "#16A34A",
            "risk_level": "Low Risk",
            "score": score,
            "headline": f"Strong Resolution Cadence ({resolution_rate}% Resolved)",
            "summary": f"Project '{project.name}' demonstrates superior defect velocity with {total_resolved} of {total_issues} issues successfully resolved.",
            "recommendation": f"Maintain active verification turnaround. {active_backlog} defects currently remain in active development pipeline."
        }
    elif resolution_rate >= 45.0:
        score = int(50 + (resolution_rate - 45) * 0.8)
        insight = {
            "health": "Stable",
            "health_color": "#2563EB",
            "risk_level": "Moderate Risk",
            "score": score,
            "headline": f"Steady Defect Throughput ({resolution_rate}% Resolved)",
            "summary": f"Consistent defect burn-down observed across sprints. Active work includes {open_count} open and {in_prog_count} in-progress issues.",
            "recommendation": "Focus developer capacity on High and Critical issues to increase overall turnaround efficiency."
        }
    else:
        score = max(20, int(resolution_rate * 0.9))
        insight = {
            "health": "Needs Attention",
            "health_color": "#D97706" if crit_high_count < 10 else "#DC2626",
            "risk_level": "Elevated Risk",
            "score": score,
            "headline": f"Backlog Accumulation Alert ({active_backlog} Active Defects)",
            "summary": f"Resolution rate currently stands at {resolution_rate}%. {active_backlog} issues are awaiting resolution or active work.",
            "recommendation": "Prioritize defect triage sessions and reallocate development resources to unblock pending items."
        }

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "lifecycle_status": project.lifecycle_status,
            "manager_name": project.project_manager.name if project.project_manager else "Unassigned",
            "created_date": project.created_date.isoformat() if project.created_date else None
        },
        "date_filter": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "applied": bool(start_date or end_date)
        },
        "summary": {
            "total_issues": total_issues,
            "open_issues": open_count,
            "in_progress_issues": in_prog_count,
            "testing_issues": testing_count,
            "resolved_issues": total_resolved,
            "resolved_only": resolved_count,
            "closed_only": closed_count,
            "active_issues": active_backlog
        },
        "status_distribution": status_distribution,
        "defect_trend": sorted_trend,
        "severity_distribution": severity_distribution,
        "quality_metrics": {
            "average_resolution_time": {
                "hours": avg_hours,
                "days": avg_days,
                "display": f"{avg_hours} hrs" if avg_hours < 48 else f"{avg_days} days"
            },
            "resolution_rate": {
                "percentage": resolution_rate,
                "display": f"{resolution_rate}%"
            },
            "defect_density": defect_density
        },
        "quality_insights": insight
    }

@analytics_bp.route("/projects/<string:project_id>", methods=["GET"])
@jwt_required()
def get_project_analytics(project_id):
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    if not can_access_project(user, role, project):
        return jsonify({"success": False, "error": "You do not have permission to view analytics for this project."}), 403

    start_date_str = request.args.get("start_date") or request.args.get("date_from")
    end_date_str = request.args.get("end_date") or request.args.get("date_to")
    
    start_date = None
    end_date = None
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"success": False, "error": "Invalid date format. Expected YYYY-MM-DD."}), 400

    analytics_data = build_project_analytics(project, user, role, start_date, end_date)
    return jsonify({
        "success": True,
        "message": f"Analytics for project '{project.name}' retrieved successfully",
        "data": analytics_data
    }), 200

@analytics_bp.route("/projects", methods=["GET"])
@jwt_required()
def get_all_projects_analytics():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    pid = request.args.get("project_id")
    if pid and pid != "All":
        project = db.session.get(Project, pid)
        if not project:
            return jsonify({"success": False, "error": "Project not found"}), 404
        if not can_access_project(user, role, project):
            return jsonify({"success": False, "error": "You do not have permission to view analytics for this project."}), 403
        data = build_project_analytics(project, user, role)
        return jsonify({
            "success": True,
            "message": f"Analytics for project '{project.name}' retrieved successfully",
            "data": data
        }), 200

    # Cross-project overview
    projects = Project.query.order_by(Project.id.asc()).all()
    accessible_projects = [p for p in projects if can_access_project(user, role, p)]
    
    summaries = []
    for p in accessible_projects:
        s = build_project_analytics(p, user, role)
        summaries.append({
            "project_id": p.id,
            "project_name": p.name,
            "summary": s["summary"],
            "resolution_rate": s["quality_metrics"]["resolution_rate"]["percentage"],
            "avg_hours": s["quality_metrics"]["average_resolution_time"]["hours"],
            "health": s["quality_insights"]["health"]
        })

    return jsonify({
        "success": True,
        "message": "Overview analytics retrieved successfully",
        "projects_count": len(accessible_projects),
        "data": summaries
    }), 200

@analytics_bp.route("/detailed", methods=["GET"])
@jwt_required()
def get_detailed_analytics():
    ident = get_jwt_identity()
    user, role = get_current_user_and_role(ident)
    if not user:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    scoped_issues = get_scoped_issues_query(user, role)
    scoped_projects = get_scoped_projects_query(user, role)

    project_id = request.args.get("project_id")
    component = request.args.get("component")
    date_range = request.args.get("date_range")
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    today = date.today()
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

    # Filter base query
    base_query = scoped_issues
    if project_id and project_id != "All":
        base_query = base_query.filter(Issue.project_id == project_id)
    if component and component != "All":
        base_query = base_query.filter(
            sa.or_(Issue.component == component, Issue.affected_module == component)
        )
    if start_date:
        base_query = base_query.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) >= start_date)
    if end_date:
        base_query = base_query.filter(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)) <= end_date)

    total_issues = base_query.count()
    open_count = base_query.filter(Issue.status == "Open").count()
    in_prog_count = base_query.filter(Issue.status == "In Progress").count()
    testing_count = base_query.filter(Issue.status == "Testing").count()
    resolved_count = base_query.filter(Issue.status == "Resolved").count()
    closed_count = base_query.filter(Issue.status == "Closed").count()

    resolved_total = resolved_count + closed_count
    unresolved_total = open_count + in_prog_count + testing_count

    resolved_pct = round(resolved_total / total_issues * 100, 1) if total_issues else 0.0
    unresolved_pct = round(unresolved_total / total_issues * 100, 1) if total_issues else 0.0

    # Average Resolution Time
    avg_res_hours = (
        db.session.query(sa.func.avg(Issue.resolution_time_hours))
        .filter(
            Issue.id.in_(base_query.with_entities(Issue.id)),
            Issue.status.in_(["Resolved", "Closed"]),
            Issue.resolution_time_hours.isnot(None),
            Issue.resolution_time_hours > 0
        )
        .scalar()
    )
    avg_hours = round(float(avg_res_hours), 1) if avg_res_hours else 0.0
    avg_days = round(avg_hours / 24.0, 1)

    # Average Issue Age (for unresolved issues)
    unresolved_issues = (
        db.session.query(sa.func.coalesce(Issue.created_date, sa.cast(Issue.created_at, sa.Date)))
        .filter(
            Issue.id.in_(base_query.with_entities(Issue.id)),
            Issue.status.in_(["Open", "In Progress", "Testing"])
        )
        .all()
    )
    ages = [(today - d[0]).days for d in unresolved_issues if d[0]]
    avg_age_days = round(sum(ages) / len(ages), 1) if ages else 0.0

    # Age brackets
    bracket_7d = sum(1 for a in ages if a <= 7)
    bracket_30d = sum(1 for a in ages if 7 < a <= 30)
    bracket_60d = sum(1 for a in ages if 30 < a <= 60)
    bracket_90d = sum(1 for a in ages if a > 60)

    age_distribution = [
        {"bracket": "< 7 Days", "count": bracket_7d, "percentage": round(bracket_7d / len(ages) * 100, 1) if ages else 0},
        {"bracket": "7 - 30 Days", "count": bracket_30d, "percentage": round(bracket_30d / len(ages) * 100, 1) if ages else 0},
        {"bracket": "30 - 60 Days", "count": bracket_60d, "percentage": round(bracket_60d / len(ages) * 100, 1) if ages else 0},
        {"bracket": "> 60 Days", "count": bracket_90d, "percentage": round(bracket_90d / len(ages) * 100, 1) if ages else 0}
    ]

    # Issues by Status
    status_order = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
    status_color_map = {
        "Open": "#E97862",
        "In Progress": "#D97706",
        "Testing": "#7C3AED",
        "Resolved": "#16A34A",
        "Closed": "#64748B"
    }
    status_counts = {
        "Open": open_count,
        "In Progress": in_prog_count,
        "Testing": testing_count,
        "Resolved": resolved_count,
        "Closed": closed_count
    }
    issues_by_status = [
        {
            "status": s,
            "count": status_counts.get(s, 0),
            "percentage": round(status_counts.get(s, 0) / total_issues * 100, 1) if total_issues else 0.0,
            "color": status_color_map.get(s, "#64748B")
        }
        for s in status_order
    ]

    # Top 5 Projects by Resolution Time
    top_projects_raw = (
        db.session.query(
            Project.id,
            Project.name,
            sa.func.avg(Issue.resolution_time_hours).label("avg_hrs"),
            sa.func.count(Issue.id).label("res_count")
        )
        .join(Issue, Issue.project_id == Project.id)
        .filter(
            Issue.status.in_(["Resolved", "Closed"]),
            Issue.resolution_time_hours.isnot(None),
            Issue.resolution_time_hours > 0,
            Project.id.in_(scoped_projects.with_entities(Project.id))
        )
        .group_by(Project.id, Project.name)
        .order_by(sa.asc("avg_hrs"))
        .limit(5)
        .all()
    )
    top_5_projects = [
        {
            "project_id": str(row[0]),
            "project_name": row[1],
            "avg_hours": round(float(row[2]), 1),
            "avg_days": round(float(row[2]) / 24.0, 1),
            "resolved_count": row[3]
        }
        for row in top_projects_raw
    ]

    # Issues by Project and Component (Matrix breakdown)
    proj_comp_raw = (
        db.session.query(
            Project.name,
            sa.func.coalesce(Issue.affected_module, Issue.component, "General").label("comp_name"),
            sa.func.count(Issue.id).label("issue_cnt")
        )
        .join(Project, Issue.project_id == Project.id)
        .filter(Issue.id.in_(base_query.with_entities(Issue.id)))
        .group_by(Project.name, "comp_name")
        .order_by(sa.desc("issue_cnt"))
        .limit(10)
        .all()
    )
    issues_by_proj_comp = [
        {
            "project": row[0],
            "component": row[1],
            "count": row[2],
            "percentage": round(row[2] / total_issues * 100, 1) if total_issues else 0.0
        }
        for row in proj_comp_raw
    ]

    # Available Components & Projects for dropdown filters
    all_components = [
        c[0] for c in db.session.query(Issue.affected_module)
        .filter(Issue.id.in_(scoped_issues.with_entities(Issue.id)), Issue.affected_module.isnot(None))
        .distinct()
        .order_by(Issue.affected_module.asc())
        .all() if c[0]
    ]

    all_projects = [
        {"id": str(p.id), "name": p.name}
        for p in scoped_projects.order_by(Project.name.asc()).all()
    ]

    return jsonify({
        "success": True,
        "data": {
            "summary": {
                "total_issues": total_issues,
                "resolved_count": resolved_total,
                "resolved_percentage": resolved_pct,
                "unresolved_count": unresolved_total,
                "unresolved_percentage": unresolved_pct,
                "average_resolution_time_hours": avg_hours,
                "average_resolution_time_days": avg_days,
                "average_issue_age_days": avg_age_days,
                "open_count": open_count,
                "in_progress_count": in_prog_count,
                "testing_count": testing_count
            },
            "age_distribution": age_distribution,
            "issues_by_status": issues_by_status,
            "top_5_projects_by_resolution_time": top_5_projects,
            "issues_by_project_and_component": issues_by_proj_comp,
            "components_list": all_components,
            "projects_list": all_projects
        }
    }), 200
