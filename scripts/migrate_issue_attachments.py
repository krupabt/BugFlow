import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db

def run_migration():
    app = create_app()
    with app.app_context():
        print("Starting safe migration for issue_attachments table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS issue_attachments (
            id SERIAL PRIMARY KEY,
            issue_id VARCHAR(50) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
            user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
            filename VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size BIGINT NOT NULL DEFAULT 0,
            content_type VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);
        CREATE INDEX IF NOT EXISTS idx_issue_attachments_user_id ON issue_attachments(user_id);
        """
        
        db.session.execute(db.text(create_table_sql))
        db.session.commit()
        print("[SUCCESS] Table `issue_attachments` created/verified successfully in PostgreSQL!")

if __name__ == "__main__":
    run_migration()
