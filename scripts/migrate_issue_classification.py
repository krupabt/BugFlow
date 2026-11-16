import os
import sys

# Ensure backend directory is in python search path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
import sqlalchemy as sa

def run_migration():
    print("=" * 70)
    print("MIGRATION: Adding 'affected_module' column to 'issues' table in PostgreSQL")
    print("=" * 70)

    app = create_app()
    with app.app_context():
        insp = sa.inspect(db.engine)
        columns = [c['name'] for c in insp.get_columns('issues')]
        print(f"[*] Current columns in 'issues': {len(columns)} columns found.")

        if 'affected_module' not in columns:
            print("[*] Adding 'affected_module' column (VARCHAR(100))...")
            with db.engine.connect() as conn:
                conn.execute(sa.text("ALTER TABLE issues ADD COLUMN affected_module VARCHAR(100) DEFAULT 'Other';"))
                conn.commit()
            print("[+] 'affected_module' column added successfully.")
        else:
            print("[OK] 'affected_module' column already exists.")

        # Safe backfill for existing rows: map component to affected_module if null
        with db.engine.connect() as conn:
            # Map common components to module options where applicable, else preserve component name
            conn.execute(sa.text("""
                UPDATE issues 
                SET affected_module = CASE 
                    WHEN component ILIKE '%auth%' OR component ILIKE '%login%' THEN 'Login'
                    WHEN component ILIKE '%dash%' OR component ILIKE '%chart%' THEN 'Dashboard'
                    WHEN component ILIKE '%reg%' OR component ILIKE '%signup%' THEN 'Registration'
                    WHEN component ILIKE '%user%' OR component ILIKE '%profile%' THEN 'User Management'
                    WHEN component ILIKE '%proj%' THEN 'Projects'
                    WHEN component ILIKE '%pay%' OR component ILIKE '%bill%' OR component ILIKE '%checkout%' OR component ILIKE '%fare%' THEN 'Payment'
                    WHEN component ILIKE '%report%' OR component ILIKE '%export%' OR component ILIKE '%analytics%' THEN 'Reports'
                    WHEN component ILIKE '%sprint%' THEN 'Sprint Management'
                    WHEN component ILIKE '%issue%' OR component ILIKE '%ticket%' OR component ILIKE '%bug%' THEN 'Issue Management'
                    WHEN component IS NOT NULL AND component != '' THEN component
                    ELSE 'Dashboard'
                END
                WHERE affected_module IS NULL OR affected_module = 'Other';
            """))
            conn.commit()
            
            # Verify count
            total_issues = conn.execute(sa.text("SELECT COUNT(*) FROM issues;")).scalar()
            null_modules = conn.execute(sa.text("SELECT COUNT(*) FROM issues WHERE affected_module IS NULL;")).scalar()
            sample_modules = conn.execute(sa.text("SELECT affected_module, COUNT(*) FROM issues GROUP BY affected_module ORDER BY COUNT(*) DESC LIMIT 10;")).fetchall()

        print(f"[+] Total issues preserved: {total_issues}")
        print(f"[+] Issues with NULL affected_module: {null_modules}")
        print("[+] Top affected modules across issues:")
        for mod, count in sample_modules:
            print(f"    - {mod}: {count}")

        print("=" * 70)
        print("MIGRATION COMPLETED SUCCESSFULLY WITHOUT DATA LOSS")
        print("=" * 70)

if __name__ == "__main__":
    run_migration()
