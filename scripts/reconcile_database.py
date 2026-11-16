import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app
from extensions import db
from sqlalchemy import text

def reconcile():
    with app.app_context():
        conn = db.engine.connect()
        trans = conn.begin()
        try:
            print("1. Removing obsolete test issues referencing projects 1 and 2...")
            res_issues = conn.execute(text("DELETE FROM issues WHERE project_id IN ('1', '2') OR id IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '22')"))
            print(f"   Deleted {res_issues.rowcount} obsolete issue records.")

            print("2. Removing obsolete project records '1' and '2'...")
            res_proj = conn.execute(text("DELETE FROM projects WHERE id IN ('1', '2') OR id NOT LIKE 'PRJ-%'"))
            print(f"   Deleted {res_proj.rowcount} obsolete project records.")

            print("3. Removing obsolete sample users '1' through '9'...")
            res_users = conn.execute(text("DELETE FROM users WHERE id NOT LIKE 'USR-%'"))
            print(f"   Deleted {res_users.rowcount} obsolete user records.")

            print("4. Ensuring project manager relationships from projects.csv...")
            conn.execute(text("""
                UPDATE projects SET project_manager_id = 'USR-002' WHERE id IN ('PRJ-001', 'PRJ-004', 'PRJ-007');
                UPDATE projects SET project_manager_id = 'USR-003' WHERE id IN ('PRJ-002', 'PRJ-005', 'PRJ-008');
                UPDATE projects SET project_manager_id = 'USR-004' WHERE id IN ('PRJ-003', 'PRJ-006');
            """))

            trans.commit()
            print("Database reconciliation transaction committed successfully.")
        except Exception as e:
            trans.rollback()
            print(f"ERROR during reconciliation: {e}")
            raise
        finally:
            conn.close()

        # Verification step
        print("\n=== VERIFICATION OF POSTGRESQL DATASET COUNTS ===")
        proj_count = db.session.execute(text("SELECT count(*) FROM projects")).scalar()
        user_count = db.session.execute(text("SELECT count(*) FROM users")).scalar()
        sprint_count = db.session.execute(text("SELECT count(*) FROM sprints")).scalar()
        issue_count = db.session.execute(text("SELECT count(*) FROM issues")).scalar()
        wf_count = db.session.execute(text("SELECT count(*) FROM workflow_states")).scalar()

        print(f"Projects count: {proj_count} (Expected: 8)")
        print(f"Users count: {user_count} (Expected: 20)")
        print(f"Sprints count: {sprint_count} (Expected: 48)")
        print(f"Issues count: {issue_count} (Expected: 730)")
        print(f"Workflow states count: {wf_count} (Expected: 5)")

        print("\n=== LIST OF ALL PROJECTS ===")
        for p in db.session.execute(text("SELECT id, name, project_manager_id, lifecycle_status FROM projects ORDER BY id")).fetchall():
            pm_name = db.session.execute(text("SELECT name FROM users WHERE id = :id"), {'id': p[2]}).scalar() or 'Unassigned'
            print(f"  {p[0]} – {p[1]} – PM: {pm_name} ({p[2]}) – Status: {p[3]}")

        print("\n=== LIST OF ALL USERS ===")
        for u in db.session.execute(text("SELECT id, name, email, role, active FROM users ORDER BY id")).fetchall():
            print(f"  {u[0]} – {u[1]} – {u[2]} – {u[3]} – Active: {u[4]}")

if __name__ == '__main__':
    reconcile()
