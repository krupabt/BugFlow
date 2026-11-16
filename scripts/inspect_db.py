import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app
from extensions import db
from sqlalchemy import text

with app.app_context():
    print("=== PROJECTS IN DATABASE ===")
    projects = db.session.execute(text("SELECT id, name, project_manager_id, lifecycle_status FROM projects ORDER BY id")).fetchall()
    for p in projects:
        print(f"ID: '{p[0]}', Name: '{p[1]}', PM: '{p[2]}', Status: '{p[3]}'")

    print("\n=== FOREIGN KEY REFERENCES TO PROJECTS '1' AND '2' ===")
    for pid in ['1', '2']:
        iss_cnt = db.session.execute(text("SELECT count(*) FROM issues WHERE project_id = :pid"), {'pid': pid}).scalar()
        spr_cnt = db.session.execute(text("SELECT count(*) FROM sprints WHERE project_id = :pid"), {'pid': pid}).scalar()
        try:
            mem_cnt = db.session.execute(text("SELECT count(*) FROM project_members WHERE project_id = :pid"), {'pid': pid}).scalar()
        except Exception:
            mem_cnt = 0
        print(f"Project '{pid}' -> Issues: {iss_cnt}, Sprints: {spr_cnt}, Members: {mem_cnt}")

    print("\n=== USERS IN DATABASE ===")
    users = db.session.execute(text("SELECT id, name, email, role, active FROM users ORDER BY id")).fetchall()
    print(f"Total Users: {len(users)}")
    for u in users:
        print(f"ID: '{u[0]}', Name: '{u[1]}', Email: '{u[2]}', Role: '{u[3]}', Active: {u[4]}")

    print("\n=== TOTAL RECORD COUNTS ===")
    print("Projects:", db.session.execute(text("SELECT count(*) FROM projects")).scalar())
    print("Users:", db.session.execute(text("SELECT count(*) FROM users")).scalar())
    print("Sprints:", db.session.execute(text("SELECT count(*) FROM sprints")).scalar())
    print("Issues:", db.session.execute(text("SELECT count(*) FROM issues")).scalar())
    print("Workflow states:", db.session.execute(text("SELECT count(*) FROM workflow_states")).scalar())
