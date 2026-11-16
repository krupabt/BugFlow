import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import sqlalchemy as sa
from extensions import db
from models.user import User, ROLE_INTERNAL_MAP

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("full_name") or data.get("name") or data.get("display_name") or "").strip()
    raw_email = (data.get("email") or "").strip()
    password = data.get("password", "")
    requested_role = (data.get("role") or "DEVELOPER").strip().upper().replace(" ", "_")
    
    # Validation
    if not name:
        return jsonify({"error": "Full name is required."}), 400
    if not raw_email:
        return jsonify({"error": "Email address is required."}), 400
    if not re.match(EMAIL_REGEX, raw_email):
        return jsonify({"error": "Please provide a valid email address."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400
        
    # Enforce: No public self-registration with Admin or Project Manager privileges
    if requested_role in ["ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER"]:
        return jsonify({"error": "Elevated roles (Admin / Project Manager) cannot be chosen via public registration. Contact your system administrator."}), 403
        
    # Default to safe role: DEVELOPER (or TESTER if selected)
    valid_public_roles = ["DEVELOPER", "TESTER"]
    role = requested_role if requested_role in valid_public_roles else "DEVELOPER"
        
    # Case-insensitive duplicate check
    if User.query.filter(sa.func.lower(User.email) == raw_email.lower()).first():
        return jsonify({"error": f"An account with email '{raw_email}' already exists."}), 409
        
    # Concurrency-safe sequential User ID: USR-xxx
    max_num = db.session.query(
        sa.func.max(sa.cast(sa.func.nullif(sa.func.regexp_replace(User.id, r'[^0-9]', '', 'g'), ''), sa.BigInteger))
    ).filter(User.id.ilike('USR-%')).scalar() or 0
    next_num = max_num + 1
    new_id = f"USR-{next_num:03d}"
    while db.session.get(User, new_id):
        next_num += 1
        new_id = f"USR-{next_num:03d}"

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
        "message": "Account created successfully.",
        "access_token": access_token,
        "user": user.to_dict()
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password", "")
    
    if not identifier:
        return jsonify({"error": "Please enter your email or username."}), 400
    if not password:
        return jsonify({"error": "Please enter your password."}), 400
        
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
        return jsonify({"error": "User not found or unauthenticated."}), 404
    return jsonify({"user": user.to_dict()}), 200

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout():
    return jsonify({"message": "Successfully logged out."}), 200
