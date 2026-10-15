from datetime import datetime, timezone
from app.extensions import db

class Issue(db.Model):
    __tablename__ = "issues"
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    issue_type = db.Column(db.String(50), nullable=False, default="Bug")
    priority = db.Column(db.String(20), nullable=False, default="Medium")
    severity = db.Column(db.String(20), nullable=False, default="Medium")
    status = db.Column(db.String(50), nullable=False, default="Open")
    
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    reported_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Relationships
    reporter = db.relationship("User", foreign_keys=[reported_by])
    assignee = db.relationship("User", foreign_keys=[assigned_to])
    comments = db.relationship("IssueComment", backref="issue", lazy="dynamic", cascade="all, delete-orphan", order_by="IssueComment.created_at.asc()")
    status_history = db.relationship("IssueStatusHistory", backref="issue", lazy="dynamic", cascade="all, delete-orphan", order_by="IssueStatusHistory.created_at.asc()")
    
    @property
    def issue_key(self):
        p_key = self.project.key if self.project else "BUG"
        return f"{p_key}-{self.id:04d}"

    @property
    def is_historical(self):
        return False

    @property
    def resolution(self):
        if self.status in ["Resolved", "Closed"]:
            return "Resolved"
        return None

    def to_dict(self, include_details=False):
        data = {
            "id": self.id,
            "issue_key": self.issue_key,
            "title": self.title,
            "description": self.description or "",
            "severity": self.severity,
            "priority": self.priority,
            "status": self.status,
            "issue_type": self.issue_type,
            "resolution": self.resolution,
            "is_historical": False,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else "General",
            "project_key": self.project.key if self.project else "GEN",
            "reporter_id": self.reported_by,
            "reporter_name": self.reporter.name if self.reporter else "System",
            "assignee_id": self.assigned_to,
            "assignee_name": self.assignee.name if self.assignee else "Unassigned",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "comments_count": self.comments.count()
        }
        if include_details:
            data["comments"] = [c.to_dict() for c in self.comments]
            data["status_history"] = [h.to_dict() for h in self.status_history]
        return data
        
    def __repr__(self):
        return f"<Issue #{self.id}: {self.title[:30]}>"
