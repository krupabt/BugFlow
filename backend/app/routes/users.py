from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import sqlalchemy as sa
from app.extensions import db
from app.models.user import User

users_bp = Blueprint("users", __name__, url_prefix="/api/users")

def get_requester():
    ident = get_jwt_identity()
    if not ident:
        return None
    return db.session.get(User, str(ident))

@users_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_users():
    role = request.args.get("role")
    active_param = request.args.get("active")
    search = request.args.get("search", "").strip()
    
    query = User.query
    if role and role != "All":
        role_filter = role.strip().upper().replace(" ", "_")
        query = query.filter(sa.func.upper(sa.func.replace(User.role, " ", "_")) == role_filter)
    if active_param is not None:
        is_active = active_param.lower() in ["true", "1"]
        query = query.filter(User.active == is_active)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.id.ilike(f"%{search}%"))
        )
        
    users = query.order_by(User.id.asc()).all()
    return jsonify([u.to_dict() for u in users]), 200

@users_bp.route("/<string:user_id>", methods=["GET"])
@jwt_required()
def get_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200

ROLE_CANONICAL = {
    "ADMIN": "ADMIN",
    "ADMINISTRATOR": "ADMIN",
    "PROJECT_MANAGER": "PROJECT_MANAGER",
    "DEVELOPER": "DEVELOPER",
    "TESTER": "TESTER"
}

@users_bp.route("", methods=["POST"])
@jwt_required()
def create_user():
    requester = get_requester()
    requester_role = (requester.role or "").strip().upper().replace(" ", "_") if (requester and requester.role) else ""
    if not requester or requester_role != "ADMIN":
        return jsonify({"error": "Only Administrators can add new users."}), 403
        
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "BugFlow@2026")
    raw_role = data.get("role", "DEVELOPER").strip().upper().replace(" ", "_")
    role = ROLE_CANONICAL.get(raw_role, "DEVELOPER")
    
    if not name or not email:
        return jsonify({"error": "Name and email are required."}), 400
        
    if User.query.filter(User.email.ilike(email)).first():
        return jsonify({"error": f"Email '{email}' is already in use."}), 409
        
    user_count = User.query.count()
    new_id = f"USR-{user_count + 1:03d}"
    while db.session.get(User, new_id):
        user_count += 1
        new_id = f"USR-{user_count + 1:03d}"

    user = User(
        id=new_id,
        name=name,
        email=email,
        role=role,
        active=True
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        "message": f"User {user.name} created successfully.",
        "user": user.to_dict()
    }), 201

@users_bp.route("/<string:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    requester = get_requester()
    requester_role = (requester.role or "").strip().upper().replace(" ", "_") if (requester and requester.role) else ""
    if not requester or requester_role != "ADMIN":
        return jsonify({"error": "Only Administrators can update user details."}), 403
        
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()
    if "email" in data and data["email"].strip():
        new_email = data["email"].strip().lower()
        conflict = User.query.filter(User.email.ilike(new_email), User.id != user_id).first()
        if conflict:
            return jsonify({"error": f"Email '{new_email}' is already in use by another user."}), 409
        user.email = new_email
    if "role" in data and data["role"].strip():
        raw_role = data["role"].strip().upper().replace(" ", "_")
        user.role = ROLE_CANONICAL.get(raw_role, user.role)
    if "active" in data:
        user.active = bool(data["active"])
    if "password" in data and data["password"].strip():
        user.set_password(data["password"].strip())
        
    db.session.commit()
    return jsonify({
        "message": f"User {user.name} updated successfully.",
        "user": user.to_dict()
    }), 200

@users_bp.route("/<string:user_id>/status", methods=["PATCH"])
@jwt_required()
def toggle_user_status(user_id):
    requester = get_requester()
    requester_role = (requester.role or "").strip().upper().replace(" ", "_") if (requester and requester.role) else ""
    if not requester or requester_role != "ADMIN":
        return jsonify({"error": "Only Administrators can activate/deactivate accounts."}), 403
        
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user.id == requester.id:
        return jsonify({"error": "You cannot deactivate your own administrative account."}), 400
        
    data = request.get_json(silent=True) or {}
    if "active" in data:
        user.active = bool(data["active"])
    else:
        user.active = not user.active
        
    db.session.commit()
    action = "activated" if user.active else "deactivated"
    return jsonify({
        "message": f"User {user.name} has been {action}.",
        "user": user.to_dict()
    }), 200

@users_bp.route("/<string:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    requester = get_requester()
    requester_role = (requester.role or "").strip().upper().replace(" ", "_") if (requester and requester.role) else ""
    if not requester or requester_role != "ADMIN":
        return jsonify({"error": "Only Administrators can delete users."}), 403
        
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user.id == requester.id:
        return jsonify({"error": "You cannot delete your own administrative account."}), 400
        
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"User {user.name} deleted successfully."}), 200
