import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()
with app.app_context():
    # 1. Update Ravi Developer with password123
    ravi = User.query.filter_by(email="ravi@bugflow.demo").first()
    if ravi:
        ravi.set_password("password123")
        print(f"[OK] Updated existing user '{ravi.email}' with password 'password123'")
    else:
        ravi = User(name="Ravi Developer", email="ravi@bugflow.demo", role="Developer")
        ravi.set_password("password123")
        db.session.add(ravi)
        print("[OK] Created user 'ravi@bugflow.demo' with password 'password123'")

    # 2. Also ensure demo user 'developer_demo' or alias exists
    demo = User.query.filter_by(email="developer@bugflow.dev").first()
    if not demo:
        demo = User(name="developer_demo", email="developer@bugflow.dev", role="Developer")
        demo.set_password("password123")
        db.session.add(demo)
        print("[OK] Created demo user 'developer@bugflow.dev' (alias: developer_demo)")
    else:
        demo.set_password("password123")

    db.session.commit()
    print("[SUCCESS] Demo credentials ready:")
    print("  Username / Email: ravi@bugflow.demo (or developer_demo)")
    print("  Password: password123")
