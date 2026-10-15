from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import sqlalchemy as sa
from app.extensions import db
from app.models.user import User, ROLE_INTERNAL_MAP

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("full_name") or data.get("name") or data.get("display_name") or data.get("username") or "").strip()
    raw_email = (data.get("email") or "").strip()
    password = data.get("password", "")
    requested_role = (data.get("role") or "DEVELOPER").strip().upper().replace(" ", "_")
    
    if not name or not raw_email or not password:
        return jsonify({"error": "Full name, email, and password are required."}), 400
        
    # Enforce: No unrestricted public Admin registration
    if requested_role in ["ADMIN", "ADMINISTRATOR"]:
        return jsonify({"error": "Admin accounts cannot be registered publicly. Please contact an existing Administrator."}), 403
        
    valid_roles = ["DEVELOPER", "TESTER", "PROJECT_MANAGER"]
    role = requested_role if requested_role in valid_roles else "DEVELOPER"
        
    # Case-insensitive check for duplicate emails
    if User.query.filter(sa.func.lower(User.email) == raw_email.lower()).first():
        return jsonify({"error": f"An account with email '{raw_email}' already exists."}), 409
        
    # Generate unique user ID: USR-xxx
    user_count = User.query.count()
    new_id = f"USR-{user_count + 1:03d}"
    while db.session.get(User, new_id):
        user_count += 1
        new_id = f"USR-{user_count + 1:03d}"

    user = User(
        id=new_id,
        name=name,
        email=raw_email,
        role=role,
        active=True
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Registration successful. You can now log in.",
        "access_token": access_token,
        "user": user.to_dict()
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password", "")
    
    if not identifier or not password:
        return jsonify({"error": "Email/username and password are required."}), 400
        
    # Case-insensitive lookup by email, display name, or user_id
    user = User.query.filter(
        (sa.func.lower(User.email) == identifier.lower()) |
        (sa.func.lower(User.name) == identifier.lower()) |
        (sa.func.lower(User.id) == identifier.lower())
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email/username or password."}), 401

    if not user.active:
        return jsonify({"error": "This account has been deactivated. Please contact an administrator."}), 403
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Login successful.",
        "access_token": access_token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = str(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200
