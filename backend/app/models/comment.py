from datetime import datetime, timezone
from app.extensions import db

class IssueComment(db.Model):
    __tablename__ = "issue_comments"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    author = db.relationship("User", foreign_keys=[user_id])
    
    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": str(self.issue_id),
            "user_id": str(self.user_id),
            "user_name": self.author.name if self.author else "Unknown",
            "author_role": self.author.role if self.author else "Member",
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
    def __repr__(self):
        return f"<IssueComment #{self.id} on Issue #{self.issue_id}>"
