from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt
from app.extensions import db

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="Developer")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    
    # Compatibility properties
    @property
    def username(self):
        return self.email.split("@")[0] if self.email else self.name

    @property
    def full_name(self):
        return self.name

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
                return False
        # Werkzeug hash (scrypt, pbkdf2)
        try:
            return check_password_hash(self.password_hash, password)
        except Exception:
            return False
        
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "full_name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
