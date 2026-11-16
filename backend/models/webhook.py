from datetime import datetime, timezone
from extensions import db

class WebhookDelivery(db.Model):
    __tablename__ = "webhook_deliveries"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    delivery_id = db.Column(db.String(100), unique=True, nullable=False, index=True) # X-GitHub-Delivery
    event_type = db.Column(db.String(50), nullable=False) # push, workflow_run, workflow_job, etc.
    action = db.Column(db.String(50), nullable=True)
    repository = db.Column(db.String(150), nullable=True)
    sender = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), default="PROCESSED", nullable=False) # PROCESSED, REJECTED, DUPLICATE, FAILED
    error_message = db.Column(db.Text, nullable=True)
    payload_summary = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "delivery_id": self.delivery_id,
            "event_type": self.event_type,
            "action": self.action,
            "repository": self.repository,
            "sender": self.sender,
            "status": self.status,
            "error_message": self.error_message,
            "payload_summary": self.payload_summary,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
