import sys
sys.path.insert(0, 'backend')
from app import app
from extensions import db
from sqlalchemy import text

with app.app_context():
    cols = db.session.execute(text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'issue_status_history'
    """)).fetchall()
    print("Columns in issue_status_history:")
    for c in cols:
        print(" -", c[0], c[1])

    count = db.session.execute(text("SELECT count(*) FROM issue_status_history")).scalar()
    print("\nTotal records:", count)
    
    tables = db.session.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)).fetchall()
    print("\nAll tables in database:")
    for t in tables:
        print(" -", t[0])

    sample = db.session.execute(text("SELECT * FROM issue_status_history ORDER BY id DESC LIMIT 5")).fetchall()
    print("\nSample records:")
    for s in sample:
        print("  *", s)
