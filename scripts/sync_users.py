import os
import sys
import pandas as pd
from werkzeug.security import generate_password_hash, check_password_hash

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath('backend'))

from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

ROLE_INTERNAL_MAP = {
    'ADMIN': 'ADMIN',
    'ADMINISTRATOR': 'ADMIN',
    'PROJECT_MANAGER': 'PROJECT_MANAGER',
    'PROJECT MANAGER': 'PROJECT_MANAGER',
    'DEVELOPER': 'DEVELOPER',
    'TESTER': 'TESTER'
}

DEFAULT_DEMO_PASSWORD = "BugFlow@2026"

def sync_users_from_csv():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    users_csv_path = os.path.join(base_dir, 'database', 'users.csv')
    
    if not os.path.exists(users_csv_path):
        print(f"[ERROR] users.csv not found at {users_csv_path}")
        return False
        
    df = pd.read_csv(users_csv_path)
    print(f"[*] Found {len(df)} user records in {users_csv_path}")
    
    hashed_pwd = generate_password_hash(DEFAULT_DEMO_PASSWORD)

    with app.app_context():
        conn = db.engine.connect()
        trans = conn.begin()
        try:
            synced_count = 0
            for _, row in df.iterrows():
                uid = str(row['user_id']).strip()
                name = str(row['display_name']).strip()
                email = str(row['email']).strip()
                raw_role = str(row['role']).strip().upper()
                role = ROLE_INTERNAL_MAP.get(raw_role, raw_role)
                active = True
                
                # Check if user already has an existing password hash
                existing_hash = conn.execute(
                    text("SELECT password_hash FROM users WHERE id = :id"),
                    {'id': uid}
                ).scalar()
                
                # If existing hash is valid for BugFlow@2026, keep it; otherwise set hashed_pwd
                final_hash = existing_hash if (existing_hash and len(existing_hash) > 10) else hashed_pwd

                conn.execute(text('''
                    INSERT INTO users (id, name, email, password_hash, role, active, created_at)
                    VALUES (:id, :name, :email, :pwd, :role, :active, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        role = EXCLUDED.role,
                        active = EXCLUDED.active,
                        password_hash = CASE
                            WHEN users.password_hash IS NOT NULL AND length(users.password_hash) > 10 THEN users.password_hash
                            ELSE EXCLUDED.password_hash
                        END
                '''), {
                    'id': uid,
                    'name': name,
                    'email': email,
                    'pwd': final_hash,
                    'role': role,
                    'active': active
                })
                synced_count += 1
                
            trans.commit()
            print(f"[OK] Successfully synchronized {synced_count} users into PostgreSQL.")
            
            # Verify the 4 key demonstration accounts
            test_accounts = [
                ('Krupa (Admin)', 'krupa@example.org', 'ADMIN'),
                ('Arun (Project Manager)', 'Arun@example.org', 'PROJECT_MANAGER'),
                ('Priya Sharma (Developer)', 'Priya.Sharma@example.org', 'DEVELOPER'),
                ('Sunil (Tester)', 'Sunil.clark@example.org', 'TESTER')
            ]
            
            print("\n[*] Verifying 4 key demonstration accounts:")
            for label, test_email, expected_role in test_accounts:
                res = conn.execute(
                    text("SELECT id, name, email, role, active, password_hash FROM users WHERE LOWER(email) = :e"),
                    {'e': test_email.lower()}
                ).fetchone()
                if res:
                    pw_valid = check_password_hash(res[5], DEFAULT_DEMO_PASSWORD)
                    status = "VALID" if pw_valid else "INVALID PASSWORD"
                    print(f"  - {label}: ID={res[0]} | Email={res[2]} | Role={res[3]} | Active={res[4]} | Password: {status}")
                else:
                    print(f"  - {label}: NOT FOUND in database!")

            return True
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] User synchronization failed: {e}")
            raise e
        finally:
            conn.close()

if __name__ == '__main__':
    sync_users_from_csv()
