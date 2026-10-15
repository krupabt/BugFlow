import os
import sys

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"[*] Starting BugFlow API Server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
