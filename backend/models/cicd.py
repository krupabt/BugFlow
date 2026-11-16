from datetime import datetime, timezone
from extensions import db

class CiCdWorkflowRun(db.Model):
    __tablename__ = "cicd_workflow_runs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    run_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    workflow_name = db.Column(db.String(120), nullable=False, default="BugFlow CI/CD Pipeline")
    branch = db.Column(db.String(100), nullable=False, default="main")
    commit_id = db.Column(db.String(100), nullable=False)
    short_sha = db.Column(db.String(20), nullable=False)
    commit_message = db.Column(db.String(255), nullable=False)
    commit_author = db.Column(db.String(100), nullable=False, default="Krupa B T")
    status = db.Column(db.String(50), nullable=False, default="SUCCESS") # SUCCESS, RUNNING, FAILED
    
    # 4 Pipeline Stages
    stage_code_push = db.Column(db.String(50), nullable=False, default="SUCCESS")
    stage_build_test = db.Column(db.String(50), nullable=False, default="SUCCESS")
    stage_tests_passed = db.Column(db.String(50), nullable=False, default="SUCCESS")
    stage_deployment = db.Column(db.String(50), nullable=False, default="SUCCESS")

    duration_seconds = db.Column(db.Integer, nullable=False, default=84)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)

    related_issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="SET NULL"), nullable=True, index=True)
    related_issue_update = db.Column(db.String(255), nullable=True)
    triggered_by = db.Column(db.String(100), nullable=False, default="Krupa B T (Admin)")
    environment = db.Column(db.String(50), nullable=False, default="Production")

    # Relationships
    test_results = db.relationship("CiCdTestResult", backref="workflow_run", lazy="joined", cascade="all, delete-orphan")
    related_issue = db.relationship("Issue", foreign_keys=[related_issue_id])

    def to_dict(self):
        duration_display = f"{self.duration_seconds // 60}m {self.duration_seconds % 60}s" if self.duration_seconds else "0s"
        return {
            "id": self.id,
            "run_id": self.run_id,
            "workflow_name": self.workflow_name,
            "branch": self.branch,
            "commit_id": self.commit_id,
            "short_sha": self.short_sha or (self.commit_id[:7] if self.commit_id else ""),
            "commit_message": self.commit_message,
            "commit_author": self.commit_author,
            "status": self.status,
            "stages": {
                "code_push": {
                    "name": "Code Push",
                    "status": self.stage_code_push,
                    "order": 1
                },
                "build_test": {
                    "name": "Build & Test",
                    "status": self.stage_build_test,
                    "order": 2
                },
                "tests_passed": {
                    "name": "Tests Passed",
                    "status": self.stage_tests_passed,
                    "order": 3
                },
                "deployment": {
                    "name": "Deployment",
                    "status": self.stage_deployment,
                    "order": 4
                }
            },
            "duration_seconds": self.duration_seconds,
            "duration_display": duration_display,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "related_issue_id": self.related_issue_id,
            "related_issue_title": self.related_issue.title if self.related_issue else None,
            "related_issue_update": self.related_issue_update,
            "triggered_by": self.triggered_by,
            "environment": self.environment,
            "tests_total": len(self.test_results) if self.test_results else 0,
            "tests_passed": sum(1 for t in self.test_results if t.status == "PASSED") if self.test_results else 0,
            "test_results": [t.to_dict() for t in self.test_results] if self.test_results else []
        }


class CiCdTestResult(db.Model):
    __tablename__ = "cicd_test_results"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    run_id = db.Column(db.Integer, db.ForeignKey("cicd_workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="API")
    status = db.Column(db.String(50), nullable=False, default="PASSED") # PASSED, FAILED, SKIPPED
    duration_ms = db.Column(db.Integer, nullable=False, default=120)
    assertions_passed = db.Column(db.Integer, nullable=False, default=5)
    assertions_total = db.Column(db.Integer, nullable=False, default=5)
    details = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "run_id": self.run_id,
            "name": self.name,
            "category": self.category,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "assertions_passed": self.assertions_passed,
            "assertions_total": self.assertions_total,
            "details": self.details
        }
