from datetime import datetime, timezone
from app.extensions import db

class Issue(db.Model):
    __tablename__ = "issues"
    
    id = db.Column(db.String(50), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    issue_type = db.Column(db.String(50), nullable=False, default="Bug")
    severity = db.Column(db.String(20), nullable=False, default="Medium")
    priority = db.Column(db.String(20), nullable=False, default="P2")
    status = db.Column(db.String(50), nullable=False, default="Open")
    
    project_id = db.Column(db.String(50), db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    reported_by = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_to = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_date = db.Column(db.Date, nullable=True)
    updated_date = db.Column(db.Date, nullable=True)
    component = db.Column(db.String(100), nullable=True)
    environment = db.Column(db.String(50), nullable=True)
    steps_to_reproduce = db.Column(db.Text, nullable=True)
    expected_result = db.Column(db.Text, nullable=True)
    actual_result = db.Column(db.Text, nullable=True)
    business_impact = db.Column(db.String(50), nullable=True)
    resolution_summary = db.Column(db.Text, nullable=True)
    root_cause = db.Column(db.Text, nullable=True)
    resolution_time_hours = db.Column(db.Numeric(10, 2), nullable=True)
    resolved_date = db.Column(db.Date, nullable=True)
    reopen_count = db.Column(db.Integer, default=0, nullable=False)
    is_duplicate = db.Column(db.Boolean, default=False, nullable=False)
    duplicate_of_issue_id = db.Column(db.String(50), nullable=True)
    sprint_id = db.Column(db.String(50), db.ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Relationships
    reporter = db.relationship("User", foreign_keys=[reported_by])
    creator = db.relationship("User", foreign_keys=[created_by])
    assignee = db.relationship("User", foreign_keys=[assigned_to])
    comments = db.relationship("IssueComment", backref="issue", lazy="dynamic", cascade="all, delete-orphan", order_by="IssueComment.created_at.asc()")
    status_history = db.relationship("IssueStatusHistory", backref="issue", lazy="dynamic", cascade="all, delete-orphan", order_by="IssueStatusHistory.created_at.asc()")
    
    @property
    def issue_key(self):
        return str(self.id)

    @property
    def is_historical(self):
        return False

    @property
    def resolution(self):
        if self.status in ["Resolved", "Closed"]:
            return self.resolution_summary or "Resolved"
        return None

    def to_dict(self, include_details=False):
        c_date = self.created_date.isoformat() if self.created_date else (self.created_at.date().isoformat() if self.created_at else None)
        u_date = self.updated_date.isoformat() if self.updated_date else (self.updated_at.date().isoformat() if self.updated_at else None)
        r_date = self.resolved_date.isoformat() if self.resolved_date else None

        data = {
            "id": str(self.id),
            "issue_id": str(self.id),
            "issue_key": str(self.id),
            "title": self.title,
            "description": self.description or "",
            "severity": self.severity,
            "priority": self.priority,
            "status": self.status,
            "issue_type": self.issue_type,
            "resolution": self.resolution,
            "component": self.component or "",
            "environment": self.environment or "",
            "steps_to_reproduce": self.steps_to_reproduce or "",
            "expected_result": self.expected_result or "",
            "actual_result": self.actual_result or "",
            "business_impact": self.business_impact or "",
            "resolution_summary": self.resolution_summary or "",
            "root_cause": self.root_cause or "",
            "resolution_time_hours": float(self.resolution_time_hours) if self.resolution_time_hours is not None else None,
            "reopen_count": self.reopen_count or 0,
            "is_duplicate": bool(self.is_duplicate),
            "duplicate_of_issue_id": self.duplicate_of_issue_id,
            "sprint_id": self.sprint_id,
            "sprint_name": self.sprint.name if self.sprint else None,
            "project_id": str(self.project_id) if self.project_id else None,
            "project_name": self.project.name if self.project else "General",
            "project_key": str(self.project_id) if self.project_id else "GEN",
            "reporter_id": str(self.reported_by) if self.reported_by else None,
            "reporter_name": self.reporter.name if self.reporter else (self.creator.name if self.creator else "System"),
            "created_by": str(self.created_by) if self.created_by else None,
            "assignee_id": str(self.assigned_to) if self.assigned_to else None,
            "assignee_name": self.assignee.name if self.assignee else "Unassigned",
            "assigned_to": str(self.assigned_to) if self.assigned_to else None,
            "created_date": c_date,
            "updated_date": u_date,
            "resolved_date": r_date,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "comments_count": self.comments.count()
        }
        if include_details:
            data["comments"] = [c.to_dict() for c in self.comments]
            data["status_history"] = [h.to_dict() for h in self.status_history]
        return data
        
    def __repr__(self):
        return f"<Issue {self.id}: {self.title[:30]}>"
