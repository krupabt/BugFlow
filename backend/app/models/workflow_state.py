from app.extensions import db

class WorkflowState(db.Model):
    __tablename__ = "workflow_states"
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    sequence = db.Column(db.Integer, nullable=True, default=1)
    terminal = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "state_id": str(self.id),
            "name": self.name,
            "state_name": self.name,
            "sequence": self.sequence,
            "terminal": self.terminal
        }

    def __repr__(self):
        return f"<WorkflowState {self.id}: {self.name}>"
