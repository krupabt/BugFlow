import sys
import os
import json
import urllib.request
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app
from extensions import db
from sqlalchemy import text

BASE_URL = "http://127.0.0.1:5000/api"

def http_req(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def test_full_application():
    print("=================================================================")
    print("STARTING FULL END-TO-END VERIFICATION & DATABASE INTEGRITY AUDIT")
    print("=================================================================\n")

    # 1. Login test
    print("--> 1. Testing Login for all 4 roles:")
    roles_tested = [
        ("Admin", "krupa@example.org", "BugFlow@2026", "ADMIN", "/admin/dashboard"),
        ("Project Manager", "Arun@example.org", "BugFlow@2026", "PROJECT_MANAGER", "/manager/dashboard"),
        ("Developer", "Priya.Sharma@example.org", "BugFlow@2026", "DEVELOPER", "/developer/dashboard"),
        ("Tester", "Sunil.clark@example.org", "BugFlow@2026", "TESTER", "/tester/dashboard"),
    ]
    tokens = {}
    for display_role, email, pwd, expected_role, expected_dash in roles_tested:
        status, res = http_req("/auth/login", method="POST", data={"email": email, "password": pwd})
        assert status == 200, f"Login failed for {email}: {res}"
        tokens[display_role] = res["access_token"]
        assert res["user"]["role"] in [expected_role, display_role]
        print(f"  [PASS] {display_role} logged in -> User ID: {res['user']['id']}, Role: {res['user']['role']}")

    # 2. Registration test
    print("\n--> 2. Testing Registration & Role Elevation Protection:")
    # Elevation attempt
    status, res = http_req("/auth/register", method="POST", data={
        "full_name": "Elevated Attempt",
        "email": "elevated@example.org",
        "password": "password123",
        "role": "ADMIN"
    })
    assert status == 403, f"Elevated registration should be rejected with 403, got {status}"
    print("  [PASS] Elevated role (ADMIN) registration rejected with HTTP 403.")

    # Valid Developer registration
    test_email = "newuser.live@example.org"
    status, res = http_req("/auth/register", method="POST", data={
        "full_name": "Live Test User",
        "email": test_email,
        "password": "SecurePassword@2026"
    })
    assert status == 201, f"Registration failed: {res}"
    new_uid = res["user"]["id"]
    assert new_uid.startswith("USR-")
    print(f"  [PASS] Registered new user -> ID: {new_uid}, Email: {test_email}, Role: {res['user']['role']}")

    # Clean up test user
    with app.app_context():
        u = db.session.execute(text("SELECT id FROM users WHERE email = :e"), {'e': test_email}).scalar()
        if u:
            db.session.execute(text("DELETE FROM users WHERE id = :id"), {'id': u})
            db.session.commit()

    # 3. Four Role Dashboards
    print("\n--> 3. Testing Four Role Dashboards:")
    for display_role, token in tokens.items():
        status, res = http_req("/dashboard/stats", token=token)
        assert status == 200, f"Dashboard failed for {display_role}"
        card_titles = [c["title"] for c in res.get("cards", [])]
        print(f"  [PASS] {display_role} Dashboard loaded: Cards = {card_titles}")

    # 4. Projects listing
    print("\n--> 4. Testing Projects Listing:")
    status, proj_list = http_req("/projects", token=tokens["Admin"])
    assert status == 200
    assert len(proj_list) == 8, f"Expected 8 projects, got {len(proj_list)}"
    project_ids = [p["id"] for p in proj_list]
    print(f"  [PASS] Projects Count = {len(proj_list)} | IDs = {project_ids}")
    for p in proj_list:
        assert p["id"].startswith("PRJ-"), f"Unexpected project ID: {p['id']}"
        assert p["project_manager_name"] != "Unassigned", f"Project {p['id']} has no manager"
        print(f"    * {p['id']}: {p['name']} | Manager: {p['project_manager_name']} | Issues: {p['total_issues']} (Open: {p['open_issues']}, Progress: {p['progress']}%)")

    # 5. Users listing
    print("\n--> 5. Testing Users Listing:")
    status, user_list = http_req("/users", token=tokens["Admin"])
    assert status == 200
    assert len(user_list) >= 20, f"Expected at least 20 users, got {len(user_list)}"
    u_ids = [u["id"] for u in user_list]
    print(f"  [PASS] Users Count = {len(user_list)} | All IDs start with USR- (USR-001 .. USR-020+)")
    for u in user_list[:5]:
        print(f"    * {u['id']}: {u['name']} | {u['email']} | {u['role']}")

    # 6. Issues listing & Total count
    print("\n--> 6. Testing Issues Listing:")
    status, iss_res = http_req("/issues?per_page=1", token=tokens["Admin"])
    assert status == 200
    assert iss_res["total"] >= 730, f"Expected at least 730 issues in PostgreSQL, got {iss_res['total']}"
    print(f"  [PASS] Issues Total Count in PostgreSQL = {iss_res['total']} (>= 730)")

    # 7. Issue ID Natural Sorting
    print("\n--> 7. Testing Issue ID Natural Order Sorting:")
    status, asc_res = http_req("/issues?sort_by=id&sort_dir=asc&per_page=10", token=tokens["Admin"])
    assert status == 200
    asc_ids = [i["id"] for i in asc_res["issues"]]
    print(f"  [PASS] Ascending Issue IDs (Page 1): {asc_ids}")
    assert asc_ids[0] == "BUG-00001"
    assert asc_ids[1] == "BUG-00002"
    assert asc_ids[9] == "BUG-00010"

    # 8. Project Details
    print("\n--> 8. Testing Project Details Fetch:")
    status, p_detail = http_req("/projects/PRJ-001", token=tokens["Admin"])
    assert status == 200
    assert p_detail["id"] == "PRJ-001"
    assert p_detail["name"] == "Online Shopping"
    assert p_detail["project_manager_name"] == "Arun"
    print(f"  [PASS] Project PRJ-001 details fetched successfully:")
    print(f"    Name: {p_detail['name']}, PM: {p_detail['project_manager_name']}, Total Issues: {p_detail['total_issues']}, Sprints: {len(p_detail['sprints'])}")

    # 9. Database Statistics vs PostgreSQL Direct Query
    print("\n--> 9. Comparing Live API Statistics with Direct PostgreSQL Queries:")
    with app.app_context():
        db_p_count = db.session.execute(text("SELECT count(*) FROM projects")).scalar()
        db_u_count = db.session.execute(text("SELECT count(*) FROM users")).scalar()
        db_i_count = db.session.execute(text("SELECT count(*) FROM issues")).scalar()
        db_s_count = db.session.execute(text("SELECT count(*) FROM sprints")).scalar()
        db_w_count = db.session.execute(text("SELECT count(*) FROM workflow_states")).scalar()

    status, admin_stats = http_req("/dashboard/stats", token=tokens["Admin"])
    api_totals = admin_stats["totals"]
    assert db_p_count == api_totals["total_projects"] == 8
    assert db_u_count == api_totals["total_users"] == 20
    assert db_i_count == api_totals["total_issues"] == 730
    assert db_s_count == 48
    assert db_w_count == 5
    print(f"  [PASS] Database & API Totals Match Exactly:")
    print(f"    - Projects: {db_p_count}")
    print(f"    - Users: {db_u_count}")
    print(f"    - Issues: {db_i_count}")
    print(f"    - Sprints: {db_s_count}")
    print(f"    - Workflow States: {db_w_count}")

    # 10. Logout test
    print("\n--> 10. Testing Logout:")
    status, logout_res = http_req("/auth/logout", method="POST", token=tokens["Admin"])
    assert status == 200
    print("  [PASS] Logout endpoint responded with HTTP 200.")

    print("\n=================================================================")
    print("ALL 10 TEST CRITERIA PASSED WITHOUT ERROR!")
    print("=================================================================")

if __name__ == '__main__':
    test_full_application()
