from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("full_name") or data.get("name") or data.get("username") or "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "Developer").strip()
    
    if not name or not email or not password:
        return jsonify({"error": "Full name, email, and password are required."}), 400
        
    if role not in ["Admin", "Developer", "Tester", "Reporter", "Project Manager"]:
        role = "Developer"
        
    if User.query.filter(User.email.ilike(email)).first():
        return jsonify({"error": f"An account with email '{email}' already exists."}), 409
        
    user = User(
        name=name,
        email=email,
        role=role
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
    # Accept either username or email field from client
    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password", "")
    
    if not identifier or not password:
        return jsonify({"error": "Email/username and password are required."}), 400
        
    user = User.query.filter(
        (User.email.ilike(identifier)) | (User.name.ilike(identifier))
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email/username or password."}), 401
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Login successful.",
        "access_token": access_token,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user.to_dict()}), 200
