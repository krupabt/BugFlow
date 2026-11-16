import sys
sys.path.insert(0, 'backend')
from app import app
from extensions import db
from sqlalchemy import text

def migrate():
    with app.app_context():
        print("Checking/Adding columns to issue_status_history...")
        queries = [
            "ALTER TABLE issue_status_history ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);",
            "ALTER TABLE issue_status_history ADD COLUMN IF NOT EXISTS field_name VARCHAR(50);",
            "ALTER TABLE issue_status_history ADD COLUMN IF NOT EXISTS old_value VARCHAR(255);",
            "ALTER TABLE issue_status_history ADD COLUMN IF NOT EXISTS new_value VARCHAR(255);"
        ]
        for q in queries:
            db.session.execute(text(q))
        db.session.commit()
        print("Columns added successfully.")

        # Backfill existing records
        rows = db.session.execute(text("SELECT id, old_status, new_status, comment FROM issue_status_history")).fetchall()
        for r in rows:
            rid, old_s, new_s, comment = r[0], r[1], r[2], (r[3] or "")
            if "Assigned to " in comment or "Assigned developer" in comment:
                assignee = comment.replace("Assigned developer set to ", "").replace("Assigned to ", "").strip()
                db.session.execute(text("""
                    UPDATE issue_status_history 
                    SET action_type = 'ASSIGNMENT', field_name = 'assigned_to', new_value = :assignee
                    WHERE id = :id
                """), {"assignee": assignee, "id": rid})
            elif old_s and new_s and old_s != new_s:
                db.session.execute(text("""
                    UPDATE issue_status_history 
                    SET action_type = 'STATUS_CHANGE', field_name = 'status', old_value = :old_s, new_value = :new_s
                    WHERE id = :id
                """), {"old_s": old_s, "new_s": new_s, "id": rid})
            elif comment.startswith("Issue reported"):
                db.session.execute(text("""
                    UPDATE issue_status_history 
                    SET action_type = 'CREATED', field_name = 'status', new_value = 'Open'
                    WHERE id = :id
                """), {"id": rid})
        db.session.commit()
        print("Existing history records backfilled successfully.")

if __name__ == "__main__":
    migrate()
