import os
import sys

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
from models.github_integration import GithubIntegration, IssueCommitLink
from models.webhook import WebhookDelivery

def migrate():
    app = create_app()
    with app.app_context():
        print("Checking and creating PostgreSQL tables for real GitHub integration...")
        db.create_all()
        print("Tables verified/created successfully.")

        # Ensure single default integration record exists
        integration = GithubIntegration.query.first()
        if not integration:
            integration = GithubIntegration(
                owner=os.getenv("GITHUB_OWNER", "krupabt"),
                repo=os.getenv("GITHUB_REPO", "BugFlow"),
                status="NOT_CONNECTED"
            )
            db.session.add(integration)
            db.session.commit()
            print("Default GitHubIntegration record initialized in NOT_CONNECTED status.")
        else:
            print(f"Existing GitHubIntegration record found: {integration.owner}/{integration.repo} (Status: {integration.status}).")

if __name__ == "__main__":
    migrate()
