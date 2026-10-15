from datetime import datetime, timezone
from app.extensions import db

project_members = db.Table(
    "project_members",
    db.Column("project_id", db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    db.Column("assigned_at", db.DateTime, default=lambda: datetime.now(timezone.utc))
)

class Project(db.Model):
    __tablename__ = "projects"
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Relationships
    issues = db.relationship("Issue", backref="project", lazy="dynamic", cascade="all, delete-orphan")
    members = db.relationship("User", secondary=project_members, backref=db.backref("projects", lazy="dynamic"), lazy="dynamic")
    
    @property
    def key(self):
        words = self.name.split()
        if len(words) > 1:
            return "".join(w[0] for w in words)[:5].upper()
        return self.name[:4].upper()
        
    def to_dict(self, include_stats=False):
        data = {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "description": self.description or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "member_count": self.members.count()
        }
        if include_stats:
            data["stats"] = {
                "total_issues": self.issues.count(),
                "open_issues": self.issues.filter_by(status="Open").count(),
                "in_progress_issues": self.issues.filter_by(status="In Progress").count(),
                "resolved_issues": self.issues.filter_by(status="Resolved").count(),
                "closed_issues": self.issues.filter_by(status="Closed").count(),
            }
        return data
        
    def __repr__(self):
        return f"<Project #{self.id}: {self.name}>"
