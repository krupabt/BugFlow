import sqlalchemy as sa
from extensions import db
from models.user import User
from models.project import Project
from models.issue import Issue

def get_current_user_and_role(identity):
    if not identity:
        return None, ""
    user = db.session.get(User, str(identity))
    if not user:
        return None, ""
    role = (user.role or "").strip().upper().replace(" ", "_")
    return user, role

def get_managed_project_ids(user_id):
    """Returns project IDs managed by a Project Manager."""
    projects = Project.query.filter_by(project_manager_id=user_id).all()
    return [p.id for p in projects]

def get_developer_project_ids(user_id):
    """Returns project IDs where this developer has assigned issues."""
    rows = db.session.query(sa.distinct(Issue.project_id)).filter(
        Issue.assigned_to == user_id,
        Issue.project_id.isnot(None)
    ).all()
    return [r[0] for r in rows if r[0]]

def get_tester_project_ids(user_id):
    """Returns project IDs relevant to this tester (reported, created, or awaiting testing)."""
    rows = db.session.query(sa.distinct(Issue.project_id)).filter(
        (Issue.reported_by == user_id) |
        (Issue.created_by == user_id) |
        (Issue.status == "Testing"),
        Issue.project_id.isnot(None)
    ).all()
    return [r[0] for r in rows if r[0]]

def get_user_accessible_project_ids(user, role):
    """Returns the list of project IDs accessible to the user, or None for unrestricted (Admin)."""
    if role in ["ADMIN", "ADMINISTRATOR"]:
        return None
    if role == "PROJECT_MANAGER":
        return get_managed_project_ids(user.id)
    if role == "DEVELOPER":
        return get_developer_project_ids(user.id)
    if role == "TESTER":
        return get_tester_project_ids(user.id)
    return []

def get_scoped_projects_query(user, role):
    """Returns a Project query filtered strictly to what the user is permitted to see."""
    if role in ["ADMIN", "ADMINISTRATOR"]:
        return Project.query
    if role == "PROJECT_MANAGER":
        return Project.query.filter(Project.project_manager_id == user.id)
    if role == "DEVELOPER":
        pids = get_developer_project_ids(user.id)
        return Project.query.filter(Project.id.in_(pids)) if pids else Project.query.filter(sa.false())
    if role == "TESTER":
        pids = get_tester_project_ids(user.id)
        return Project.query.filter(Project.id.in_(pids)) if pids else Project.query.filter(sa.false())
    return Project.query.filter(sa.false())

def can_access_project(user, role, project):
    """Returns True if the user has permission to view/interact with the given project."""
    if not user or not project:
        return False
    if role in ["ADMIN", "ADMINISTRATOR"]:
        return True
    if role == "PROJECT_MANAGER":
        return project.project_manager_id == user.id
    if role == "DEVELOPER":
        pids = get_developer_project_ids(user.id)
        return project.id in pids
    if role == "TESTER":
        pids = get_tester_project_ids(user.id)
        return project.id in pids
    return False

def get_scoped_issues_query(user, role):
    """Returns an Issue query filtered strictly to what the user is permitted to see."""
    if role in ["ADMIN", "ADMINISTRATOR"]:
        return Issue.query
    if role == "PROJECT_MANAGER":
        pm_pids = get_managed_project_ids(user.id)
        return Issue.query.filter(Issue.project_id.in_(pm_pids)) if pm_pids else Issue.query.filter(sa.false())
    if role == "DEVELOPER":
        return Issue.query.filter(Issue.assigned_to == user.id)
    if role == "TESTER":
        return Issue.query.filter(
            (Issue.reported_by == user.id) |
            (Issue.created_by == user.id) |
            (Issue.status == "Testing")
        )
    return Issue.query.filter((Issue.assigned_to == user.id) | (Issue.reported_by == user.id))

def can_access_issue(user, role, issue):
    """Returns True if the user has permission to view/interact with the given issue."""
    if not user or not issue:
        return False
    if role in ["ADMIN", "ADMINISTRATOR"]:
        return True
    if role == "PROJECT_MANAGER":
        pm_pids = get_managed_project_ids(user.id)
        return issue.project_id in pm_pids
    if role == "DEVELOPER":
        return issue.assigned_to == user.id
    if role == "TESTER":
        return (issue.reported_by == user.id) or (issue.created_by == user.id) or (issue.status == "Testing")
    return (issue.assigned_to == user.id) or (issue.reported_by == user.id)
