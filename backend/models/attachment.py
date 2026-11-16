from datetime import datetime, timezone
from extensions import db

class IssueAttachment(db.Model):
    __tablename__ = "issue_attachments"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False, default=0)
    content_type = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    uploader = db.relationship("User", foreign_keys=[user_id])
    
    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": str(self.issue_id),
            "user_id": str(self.user_id) if self.user_id else None,
            "user_name": self.uploader.name if self.uploader else "System",
            "filename": self.filename,
            "file_size": self.file_size,
            "file_size_formatted": self.format_file_size(self.file_size),
            "content_type": self.content_type,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

    @staticmethod
    def format_file_size(size_bytes):
        if not size_bytes:
            return "0 B"
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{int(size_bytes)} B"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"

    def __repr__(self):
        return f"<IssueAttachment #{self.id} for #{self.issue_id}: {self.filename}>"
