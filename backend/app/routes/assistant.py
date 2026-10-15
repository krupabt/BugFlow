from flask import Blueprint, request, jsonify
from app.services.recommender import recommender

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

@assistant_bp.route("/similar", methods=["POST"])
def get_similar():
    data = request.get_json() or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    top_k = min(data.get("top_k", 3), 10)
    
    if not title:
        return jsonify({"error": "Issue title is required for similarity analysis"}), 400
        
    analysis = recommender.find_similar_issues(
        query_title=title,
        query_description=description,
        top_k=top_k
    )
    return jsonify(analysis), 200
