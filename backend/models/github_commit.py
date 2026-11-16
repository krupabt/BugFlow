from datetime import datetime, timezone
from extensions import db

class GithubCommit(db.Model):
    __tablename__ = "github_commits"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = db.Column(db.String(50), db.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    repository_name = db.Column(db.String(150), nullable=False, default="krupabt/BugFlow")
    commit_id = db.Column(db.String(100), nullable=False, index=True)
    short_sha = db.Column(db.String(20), nullable=False)
    commit_message = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(100), nullable=False, default="Krupa B T")
    author_email = db.Column(db.String(120), nullable=True, default="krupabt83@gmail.com")
    author_avatar = db.Column(db.String(255), nullable=True)
    branch = db.Column(db.String(100), nullable=False, default="main")
    files_changed_count = db.Column(db.Integer, default=1, nullable=False)
    additions = db.Column(db.Integer, default=0, nullable=False)
    deletions = db.Column(db.Integer, default=0, nullable=False)
    diff_content = db.Column(db.Text, nullable=True)
    files_summary = db.Column(db.JSON, nullable=True)
    view_url = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default="Linked", nullable=False)
    committed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    issue = db.relationship("Issue", foreign_keys=[issue_id], backref=db.backref("github_commits", lazy="dynamic"))
    project = db.relationship("Project", foreign_keys=[project_id])

    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": self.issue_id,
            "project_id": self.project_id,
            "repository_name": self.repository_name,
            "commit_id": self.commit_id,
            "short_sha": self.short_sha or (self.commit_id[:7] if self.commit_id else ""),
            "commit_message": self.commit_message,
            "author_name": self.author_name,
            "author_email": self.author_email,
            "author_avatar": self.author_avatar,
            "branch": self.branch,
            "files_changed_count": self.files_changed_count,
            "additions": self.additions,
            "deletions": self.deletions,
            "diff_content": self.diff_content,
            "files_summary": self.files_summary or [],
            "view_url": self.view_url or f"https://github.com/{self.repository_name}/commit/{self.commit_id}",
            "status": self.status,
            "committed_at": self.committed_at.isoformat() if self.committed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
