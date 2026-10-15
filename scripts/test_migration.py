import os
import sys
import pandas as pd
from datetime import datetime
from werkzeug.security import generate_password_hash

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath('backend'))

from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

def migrate_and_import():
    with app.app_context():
        conn = db.engine.connect()
        trans = conn.begin()
        try:
            print("[1/5] Modifying table schema to support synthetic dataset keys...")
            
            # Drop existing foreign key constraints
            fk_drops = [
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_project_id_fkey",
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_reported_by_fkey",
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_assigned_to_fkey",
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_created_by_fkey",
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_sprint_id_fkey",
                "ALTER TABLE IF EXISTS issues DROP CONSTRAINT IF EXISTS issues_duplicate_of_issue_id_fkey",
                "ALTER TABLE IF EXISTS project_members DROP CONSTRAINT IF EXISTS project_members_project_id_fkey",
                "ALTER TABLE IF EXISTS project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey",
                "ALTER TABLE IF EXISTS issue_comments DROP CONSTRAINT IF EXISTS issue_comments_issue_id_fkey",
                "ALTER TABLE IF EXISTS issue_comments DROP CONSTRAINT IF EXISTS issue_comments_user_id_fkey",
                "ALTER TABLE IF EXISTS issue_status_history DROP CONSTRAINT IF EXISTS issue_status_history_issue_id_fkey",
                "ALTER TABLE IF EXISTS issue_status_history DROP CONSTRAINT IF EXISTS issue_status_history_changed_by_id_fkey",
                "ALTER TABLE IF EXISTS sprints DROP CONSTRAINT IF EXISTS sprints_project_id_fkey",
                "ALTER TABLE IF EXISTS sprints DROP CONSTRAINT IF EXISTS sprints_created_by_fkey",
                "ALTER TABLE IF EXISTS projects DROP CONSTRAINT IF EXISTS projects_project_manager_id_fkey",
            ]
            for sql in fk_drops:
                conn.execute(text(sql))

            # Alter ID columns to VARCHAR(50)
            id_alters = [
                "ALTER TABLE IF EXISTS users ALTER COLUMN id TYPE VARCHAR(50) USING id::text",
                "ALTER TABLE IF EXISTS projects ALTER COLUMN id TYPE VARCHAR(50) USING id::text",
                "ALTER TABLE IF EXISTS sprints ALTER COLUMN id TYPE VARCHAR(50) USING id::text",
                "ALTER TABLE IF EXISTS workflow_states ALTER COLUMN id TYPE VARCHAR(50) USING id::text",
                "ALTER TABLE IF EXISTS issues ALTER COLUMN id TYPE VARCHAR(50) USING id::text",
                
                "ALTER TABLE IF EXISTS issues ALTER COLUMN project_id TYPE VARCHAR(50) USING project_id::text",
                "ALTER TABLE IF EXISTS issues ALTER COLUMN reported_by TYPE VARCHAR(50) USING reported_by::text",
                "ALTER TABLE IF EXISTS issues ALTER COLUMN assigned_to TYPE VARCHAR(50) USING assigned_to::text",
                
                "ALTER TABLE IF EXISTS project_members ALTER COLUMN project_id TYPE VARCHAR(50) USING project_id::text",
                "ALTER TABLE IF EXISTS project_members ALTER COLUMN user_id TYPE VARCHAR(50) USING user_id::text",
                
                "ALTER TABLE IF EXISTS issue_comments ALTER COLUMN issue_id TYPE VARCHAR(50) USING issue_id::text",
                "ALTER TABLE IF EXISTS issue_comments ALTER COLUMN user_id TYPE VARCHAR(50) USING user_id::text",
                
                "ALTER TABLE IF EXISTS issue_status_history ALTER COLUMN issue_id TYPE VARCHAR(50) USING issue_id::text",
                "ALTER TABLE IF EXISTS issue_status_history ALTER COLUMN changed_by_id TYPE VARCHAR(50) USING changed_by_id::text",
                
                "ALTER TABLE IF EXISTS sprints ALTER COLUMN project_id TYPE VARCHAR(50) USING project_id::text",
                "ALTER TABLE IF EXISTS sprints ALTER COLUMN created_by TYPE VARCHAR(50) USING created_by::text",
            ]
            for sql in id_alters:
                conn.execute(text(sql))

            # Add missing columns
            col_adds = [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE",
                
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_manager_id VARCHAR(50)",
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50) DEFAULT 'ACTIVE'",
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_date DATE",
                
                "ALTER TABLE sprints ADD COLUMN IF NOT EXISTS sprint_name VARCHAR(150)",
                
                "ALTER TABLE workflow_states ADD COLUMN IF NOT EXISTS sequence INTEGER",
                "ALTER TABLE workflow_states ADD COLUMN IF NOT EXISTS terminal BOOLEAN DEFAULT FALSE",
                
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_date DATE",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_date DATE",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS component VARCHAR(100)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS environment VARCHAR(50)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS expected_result TEXT",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS actual_result TEXT",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS business_impact VARCHAR(50)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_summary TEXT",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS root_cause TEXT",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_time_hours NUMERIC(10,2)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_date DATE",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS duplicate_of_issue_id VARCHAR(50)",
                "ALTER TABLE issues ADD COLUMN IF NOT EXISTS sprint_id VARCHAR(50)",
            ]
            for sql in col_adds:
                conn.execute(text(sql))

            # Add foreign keys back
            fk_adds = [
                "ALTER TABLE issues ADD CONSTRAINT issues_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE",
                "ALTER TABLE issues ADD CONSTRAINT issues_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL",
                "ALTER TABLE issues ADD CONSTRAINT issues_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
                "ALTER TABLE projects ADD CONSTRAINT projects_project_manager_id_fkey FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL",
                "ALTER TABLE sprints ADD CONSTRAINT sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE",
                "ALTER TABLE project_members ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE",
                "ALTER TABLE project_members ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
                "ALTER TABLE issue_comments ADD CONSTRAINT issue_comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE",
                "ALTER TABLE issue_comments ADD CONSTRAINT issue_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
                "ALTER TABLE issue_status_history ADD CONSTRAINT issue_status_history_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE",
                "ALTER TABLE issue_status_history ADD CONSTRAINT issue_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES users(id) ON DELETE SET NULL",
            ]
            for sql in fk_adds:
                try:
                    conn.execute(text(sql))
                except Exception as e:
                    print(f"Notice adding FK ({sql[:35]}...): {e}")

            trans.commit()
            print("[OK] Schema updated successfully.")

        except Exception as e:
            trans.rollback()
            print(f"[ERROR] Schema update failed: {e}")
            raise e
        finally:
            conn.close()

if __name__ == '__main__':
    migrate_and_import()
