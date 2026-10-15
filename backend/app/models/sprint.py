from datetime import datetime, timezone
from app.extensions import db

class Sprint(db.Model):
    __tablename__ = "sprints"
    
    id = db.Column(db.String(50), primary_key=True)
    project_id = db.Column(db.String(50), db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    sprint_name = db.Column(db.String(150), nullable=True)
    goal = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=False, default="PLANNED")
    created_by = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Relationships
    issues = db.relationship("Issue", backref="sprint", lazy="dynamic")
    creator = db.relationship("User", foreign_keys=[created_by])
    
    def to_dict(self, include_issues=False):
        data = {
            "id": str(self.id),
            "sprint_id": str(self.id),
            "project_id": str(self.project_id),
            "project_name": self.project.name if self.project else "",
            "name": self.name or self.sprint_name,
            "sprint_name": self.sprint_name or self.name,
            "goal": self.goal or "",
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "issue_count": self.issues.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_issues:
            data["issues"] = [i.to_dict() for i in self.issues.all()]
        return data

    def __repr__(self):
        return f"<Sprint {self.id}: {self.name} ({self.status})>"
