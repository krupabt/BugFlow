import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app import create_app

app = create_app()
print("[OK] Flask app created successfully!")
print(f"[OK] Total registered endpoints: {len(list(app.url_map.iter_rules()))}")
for r in app.url_map.iter_rules():
    if not r.rule.startswith("/static"):
        print(f"  {r.rule} -> {sorted(list(r.methods - {'OPTIONS', 'HEAD'}))}")
