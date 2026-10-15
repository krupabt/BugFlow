from flask import Flask, jsonify
from app.config import Config
from app.extensions import db, jwt, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:5000",
                    "http://127.0.0.1:5000"
                ],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"]
            }
        }
    )
    
    # Register API blueprints
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.issues import issues_bp
    from app.routes.projects import projects_bp
    from app.routes.sprints import sprints_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.reports import reports_bp
    from app.routes.assistant import assistant_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(issues_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(sprints_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(assistant_bp)
    
    # Health check route
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "BugFlow API",
            "version": "1.0.0"
        }), 200

    # Ensure dataset is loaded on first startup
    with app.app_context():
        try:
            from app.db_importer import ensure_dataset_imported
            ensure_dataset_imported()
        except Exception as e:
            app.logger.warning(f"Startup dataset check notice: {e}")

    # Global JSON error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request", "message": str(e.description if hasattr(e, 'description') else e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500
        
    return app
