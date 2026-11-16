import os
import sys

# Ensure backend directory is in python search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from flask import Flask, jsonify
from config import Config
from extensions import db, jwt, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions with PostgreSQL & JWT
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"]
            }
        }
    )
    
    # Register Authentication & Role Management routes
    from routes.auth import auth_bp
    from routes.users import users_bp
    from routes.dashboard import dashboard_bp
    from routes.issues import issues_bp
    from routes.projects import projects_bp
    from routes.sprints import sprints_bp
    from routes.reports import reports_bp
    from routes.analytics import analytics_bp
    from routes.assistant import assistant_bp
    from routes.github import github_bp
    from routes.cicd import cicd_bp
    from routes.webhooks import webhooks_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(issues_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(sprints_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(assistant_bp)
    app.register_blueprint(github_bp)
    app.register_blueprint(cicd_bp)
    app.register_blueprint(webhooks_bp)
    
    # Health check endpoint
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "BugFlow API",
            "version": "1.0.0"
        }), 200

    # Ensure dataset is synchronized with PostgreSQL on startup
    with app.app_context():
        try:
            from db_importer import ensure_dataset_imported
            ensure_dataset_imported()
        except Exception as e:
            app.logger.warning(f"Startup dataset synchronization notice: {e}")

    # Global JSON error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request", "message": str(e.description if hasattr(e, 'description') else e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized", "message": str(e.description if hasattr(e, 'description') else e)}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Forbidden", "message": str(e.description if hasattr(e, 'description') else e)}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500
        
    return app

# Singleton app instance for run.py and WSGI servers
app = create_app()

# Setup compatibility alias in sys.modules so 'app.xxx' imports continue working if invoked
current_module = sys.modules[__name__]
sys.modules['app'] = current_module
import extensions
import models
import routes
sys.modules['app.extensions'] = extensions
sys.modules['app.models'] = models
sys.modules['app.routes'] = routes

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"[*] Starting BugFlow API Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
