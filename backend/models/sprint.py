from datetime import datetime, timezone
from extensions import db

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
        from models.issue import Issue
        total_issues = self.issues.count()
        completed_issues = self.issues.filter(Issue.status.in_(["Resolved", "Closed"])).count()
        in_progress_issues = self.issues.filter(Issue.status.in_(["In Progress", "Testing"])).count()
        remaining_issues = max(0, total_issues - completed_issues)
        progress = round((completed_issues / total_issues * 100), 1) if total_issues > 0 else 0.0

        duration_days = None
        if self.start_date and self.end_date:
            duration_days = (self.end_date - self.start_date).days

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
            "duration_days": duration_days,
            "duration_label": f"{duration_days} days" if duration_days is not None else "—",
            "status": self.status,
            "issue_count": total_issues,
            "total_issues": total_issues,
            "completed_issues": completed_issues,
            "in_progress_issues": in_progress_issues,
            "remaining_issues": remaining_issues,
            "progress": progress,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_by_name": self.creator.name if self.creator else (self.project.project_manager.name if self.project and self.project.project_manager else "System Admin"),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_issues:
            data["issues"] = [i.to_dict() for i in self.issues.order_by(Issue.id.asc()).all()]
        return data

    def __repr__(self):
        return f"<Sprint {self.id}: {self.name} ({self.status})>"
