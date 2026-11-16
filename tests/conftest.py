import os
import sys
import pytest

# Ensure backend directory is in python search path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(base_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
import models
from db_importer import ensure_dataset_imported

@pytest.fixture(scope="session")
def app():
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        try:
            db.create_all()
            from models.user import User
            if not User.query.filter_by(email="krupa@example.org").first():
                ensure_dataset_imported()
        except Exception as e:
            print(f"Warning during test DB setup: {e}")
    yield app

@pytest.fixture(scope="session")
def client(app):
    return app.test_client()

@pytest.fixture(scope="session")
def admin_headers(client):
    res = client.post("/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "BugFlow@2026"
    })
    token = res.get_json().get("access_token")
    return {"Authorization": f"Bearer {token}"}
