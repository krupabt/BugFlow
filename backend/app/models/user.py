from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt
from app.extensions import db

ROLE_DISPLAY_MAP = {
    'ADMIN': 'Admin',
    'PROJECT_MANAGER': 'Project Manager',
    'DEVELOPER': 'Developer',
    'TESTER': 'Tester'
}

ROLE_INTERNAL_MAP = {
    'ADMIN': 'ADMIN',
    'ADMINISTRATOR': 'ADMIN',
    'Admin': 'ADMIN',
    'PROJECT_MANAGER': 'PROJECT_MANAGER',
    'PROJECT MANAGER': 'PROJECT_MANAGER',
    'Project Manager': 'PROJECT_MANAGER',
    'DEVELOPER': 'DEVELOPER',
    'Developer': 'DEVELOPER',
    'TESTER': 'TESTER',
    'Tester': 'TESTER'
}

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="DEVELOPER")
    active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Compatibility properties
    @property
    def username(self):
        return self.email.split("@")[0] if self.email else self.name

    @property
    def full_name(self):
        return self.name

    @property
    def role_display(self):
        role_raw = (self.role or '').strip().upper().replace(' ', '_')
        return ROLE_DISPLAY_MAP.get(role_raw, self.role)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        # If stored with bcrypt ($2a$, $2b$, $2y$)
        if self.password_hash.startswith("$2"):
            try:
                return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))
            except Exception:
                pass
        # Werkzeug hash (scrypt, pbkdf2)
        try:
            return check_password_hash(self.password_hash, password)
        except Exception:
            return False
        
    def to_dict(self):
        role_raw = (self.role or '').strip().upper().replace(' ', '_')
        return {
            "id": str(self.id),
            "user_id": str(self.id),
            "name": self.name,
            "display_name": self.name,
            "username": self.username,
            "email": self.email,
            "role": role_raw,
            "role_display": ROLE_DISPLAY_MAP.get(role_raw, self.role),
            "active": bool(self.active),
            "full_name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
    def __repr__(self):
        return f"<User {self.id}: {self.email} ({self.role})>"
