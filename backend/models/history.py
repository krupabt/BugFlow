from datetime import datetime, timezone
from extensions import db

class IssueStatusHistory(db.Model):
    __tablename__ = "issue_status_history"
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    issue_id = db.Column(db.String(50), db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by_id = db.Column(db.String(50), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    old_status = db.Column(db.String(50), nullable=True)
    new_status = db.Column(db.String(50), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    action_type = db.Column(db.String(50), nullable=True, default="STATUS_CHANGE")
    field_name = db.Column(db.String(50), nullable=True)
    old_value = db.Column(db.String(255), nullable=True)
    new_value = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship to user
    changed_by = db.relationship("User", foreign_keys=[changed_by_id])
    
    def to_dict(self):
        user_name = self.changed_by.name if self.changed_by else "System"
        issue_key = str(self.issue_id)
        raw_comment = (self.comment or "").strip()
        act_type = (self.action_type or "").upper()
        
        # Priority mapping helper
        pri_labels = {"P0": "Critical", "P1": "Urgent", "P2": "High", "P3": "Medium", "P4": "Low"}
        reason = None
        
        # 1. Sprint Assignment (checked first so "Assigned to sprint" isn't confused with user assignment)
        if act_type == "SPRINT_ASSIGNED" or "assigned to sprint" in raw_comment.lower():
            act_type = "SPRINT_ASSIGNED"
            sprint_val = self.new_value or raw_comment.replace("Assigned to sprint ", "").strip()
            description = f"{user_name} assigned {issue_key} to sprint {sprint_val}."

        # 2. Assignment (User / Developer)
        elif act_type == "ASSIGNMENT" or raw_comment.startswith("Assigned developer set to ") or (raw_comment.startswith("Assigned to ") and "sprint" not in raw_comment.lower()):
            act_type = "ASSIGNMENT"
            assignee = self.new_value or raw_comment.replace("Assigned developer set to ", "").replace("Assigned to ", "").strip()
            if not assignee or assignee.lower() == "unassigned":
                description = f"{user_name} unassigned {issue_key}."
            else:
                description = f"{user_name} assigned {issue_key} to {assignee}."

        # 3. Priority change
        elif act_type == "PRIORITY_CHANGE" or "priority from" in raw_comment.lower():
            act_type = "PRIORITY_CHANGE"
            old_p = pri_labels.get(self.old_value, self.old_value) or "Medium"
            new_p = pri_labels.get(self.new_value, self.new_value) or "High"
            description = f"{user_name} changed {issue_key} priority from {old_p} to {new_p}."

        # 4. Severity change
        elif act_type == "SEVERITY_CHANGE" or "severity from" in raw_comment.lower():
            act_type = "SEVERITY_CHANGE"
            old_s = self.old_value or "Medium"
            new_s = self.new_value or "High"
            description = f"{user_name} changed {issue_key} severity from {old_s} to {new_s}."

        # 5. Issue Creation
        elif act_type == "CREATED" or raw_comment.startswith("Issue reported"):
            act_type = "CREATED"
            description = f"{user_name} reported {issue_key}."

        # 6. Project Reassignment
        elif act_type == "PROJECT_CHANGE" or raw_comment.startswith("Moved project from"):
            act_type = "PROJECT_CHANGE"
            description = f"{user_name} {raw_comment.lower()} for {issue_key}."

        # 7. Comment Added
        elif act_type == "COMMENT_ADDED":
            description = f"{user_name} added a comment on {issue_key}."
            if raw_comment:
                reason = raw_comment

        # 8. Attachment Uploaded / Deleted
        elif act_type == "ATTACHMENT_UPLOADED":
            filename = self.new_value or "file"
            description = f"{user_name} uploaded attachment '{filename}' to {issue_key}."
        elif act_type == "ATTACHMENT_DELETED":
            filename = self.old_value or "file"
            description = f"{user_name} removed attachment '{filename}' from {issue_key}."

        # 9. Issue Details Updated
        elif act_type == "ISSUE_UPDATED":
            description = f"{user_name} updated issue details for {issue_key}."
            if raw_comment:
                reason = raw_comment

        # 10. Status change
        elif self.old_status and self.new_status and (self.old_status != self.new_status):
            act_type = "STATUS_CHANGE"
            description = f"{user_name} changed {issue_key} from {self.old_status} to {self.new_status}."
            if raw_comment and not raw_comment.startswith("Status changed from") and not raw_comment.startswith("Issue reopened"):
                reason = raw_comment

        # 11. Fallback when old_status == new_status or generic comment
        else:
            if raw_comment:
                description = f"{user_name} updated {issue_key}: {raw_comment}."
            else:
                description = f"{user_name} updated {issue_key}."

        return {
            "id": self.id,
            "issue_id": issue_key,
            "issue_title": self.issue.title if self.issue else "",
            "project_id": str(self.issue.project_id) if self.issue and self.issue.project_id else None,
            "project_name": self.issue.project.name if self.issue and self.issue.project else "",
            "changed_by": user_name,
            "changed_by_id": self.changed_by_id,
            "action_type": act_type,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "description": description,
            "reason": reason,
            "comment": raw_comment,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
    def __repr__(self):
        return f"<IssueStatusHistory Issue #{self.issue_id}: {self.action_type}>"
