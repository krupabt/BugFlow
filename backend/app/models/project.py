from datetime import datetime, timezone
from app.extensions import db

project_members = db.Table(
    "project_members",
    db.Column("project_id", db.String(50), db.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    db.Column("user_id", db.String(50), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    db.Column("assigned_at", db.DateTime, default=lambda: datetime.now(timezone.utc))
)

class Project(db.Model):
    __tablename__ = "projects"
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_date = db.Column(db.Date, nullable=True)
    project_manager_id = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lifecycle_status = db.Column(db.String(50), default="ACTIVE")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Relationships
    project_manager = db.relationship("User", foreign_keys=[project_manager_id])
    issues = db.relationship("Issue", backref="project", lazy="dynamic", cascade="all, delete-orphan")
    sprints = db.relationship("Sprint", backref="project", lazy="dynamic", cascade="all, delete-orphan")
    members = db.relationship("User", secondary=project_members, backref=db.backref("projects", lazy="dynamic"), lazy="dynamic")
    
    @property
    def key(self):
        return str(self.id)
        
    def to_dict(self, include_stats=False):
        total_issues = self.issues.count() if include_stats else 0
        resolved_issues = self.issues.filter(Issue.status.in_(["Resolved", "Closed"])).count() if include_stats else 0
        open_issues = self.issues.filter_by(status="Open").count() if include_stats else 0
        in_progress = self.issues.filter_by(status="In Progress").count() if include_stats else 0
        testing = self.issues.filter_by(status="Testing").count() if include_stats else 0
        closed = self.issues.filter_by(status="Closed").count() if include_stats else 0
        
        progress = round((resolved_issues / total_issues * 100), 1) if total_issues > 0 else 0.0

        data = {
            "id": str(self.id),
            "project_id": str(self.id),
            "key": str(self.id),
            "name": self.name,
            "project_name": self.name,
            "description": self.description or "",
            "lifecycle_status": self.lifecycle_status or "ACTIVE",
            "project_manager_id": self.project_manager_id,
            "project_manager_name": self.project_manager.name if self.project_manager else "Unassigned",
            "created_date": self.created_date.isoformat() if self.created_date else (self.created_at.date().isoformat() if self.created_at else None),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "member_count": self.members.count()
        }
        if include_stats:
            data["stats"] = {
                "total_issues": total_issues,
                "open_issues": open_issues,
                "in_progress_issues": in_progress,
                "testing_issues": testing,
                "resolved_issues": resolved_issues,
                "closed_issues": closed,
                "progress_percentage": progress,
            }
            data["total_issues"] = total_issues
            data["open_issues"] = open_issues
            data["progress"] = progress
        return data
        
    def __repr__(self):
        return f"<Project {self.id}: {self.name}>"

# Avoid circular import
from app.models.issue import Issue
