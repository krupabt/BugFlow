from datetime import datetime, timezone
from app.extensions import db

class IssueStatusHistory(db.Model):
    __tablename__ = "issue_status_history"
    
    id = db.Column(db.Integer, primary_key=True)
    issue_id = db.Column(db.Integer, db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    old_status = db.Column(db.String(20), nullable=True)
    new_status = db.Column(db.String(20), nullable=False)
    comment = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship to user
    changed_by = db.relationship("User", foreign_keys=[changed_by_id])
    
    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": self.issue_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "comment": self.comment,
            "changed_by": self.changed_by.full_name or self.changed_by.username if self.changed_by else "System",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
    def __repr__(self):
        return f"<IssueStatusHistory Issue #{self.issue_id}: {self.old_status} -> {self.new_status}>"
