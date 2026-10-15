"""
BugFlow - PostgreSQL Database Connection & Table Verification Script
---------------------------------------------------------------------
This script safely tests the connection between Flask-SQLAlchemy and
your PostgreSQL 'bugflow_db' database.

SAFETY GUARANTEE:
- This script NEVER drops, resets, or deletes existing data or tables.
- It only creates missing tables (CREATE TABLE IF NOT EXISTS via db.create_all()).
"""

import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
env_path = os.path.join(backend_dir, ".env")
load_dotenv(env_path)

def test_connection():
    print("=" * 60)
    print("   BugFlow Database Connection & Verification Tool")
    print("=" * 60)
    
    db_user = os.getenv("DB_USER", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "bugflow_db")
    db_pass = os.getenv("DB_PASSWORD")
    
    print(f"[*] Target Host    : {db_host}:{db_port}")
    print(f"[*] Target Database: {db_name}")
    print(f"[*] Target User    : {db_user}")
    
    if not db_pass:
        print("\n[!] WARNING: DB_PASSWORD is not set in backend/.env!")
        print("    Please create/edit D:\\BugFlow\\backend\\.env with:")
        print("    DB_PASSWORD=your_actual_password\n")
    
    try:
        from app import create_app
        from app.extensions import db
        import sqlalchemy as sa
        
        app = create_app()
        
        with app.app_context():
            print("[*] Testing connection using SQLAlchemy engine...")
            with db.engine.connect() as conn:
                result = conn.execute(sa.text("SELECT version();"))
                version = result.scalar()
                print(f"[OK] Successfully connected to PostgreSQL!")
                print(f"     Engine Version: {version[:55]}...")
                
            print("\n[*] Synchronizing models with PostgreSQL (CREATE IF NOT EXISTS)...")
            # Safe creation of tables without dropping anything
            db.create_all()
            print("[OK] Tables synchronized successfully.")
            
            # Inspect existing tables in bugflow_db
            inspector = sa.inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"\n[OK] Current tables in '{db_name}':")
            for t in sorted(tables):
                cols = inspector.get_columns(t)
                col_names = [c["name"] for c in cols]
                print(f"     - {t} ({len(cols)} columns: {', '.join(col_names[:5])}...)")
                
            print("\n" + "=" * 60)
            print("   Database is ready for BugFlow API & Demonstration!")
            print("=" * 60)
            return True
            
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("\nTroubleshooting tips:")
        print("1. Ensure PostgreSQL service is running on Windows (service: postgresql-x64-17).")
        print("2. Ensure database 'bugflow_db' exists.")
        print(f"3. Verify your password in D:\\BugFlow\\backend\\.env: DB_PASSWORD=your_password")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
