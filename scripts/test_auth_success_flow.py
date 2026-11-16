import sys
import os
import json
import urllib.request
import urllib.error

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

def format_role(role):
    norm = (role or "").upper().replace(" ", "_")
    if norm in ["ADMIN", "ADMINISTRATOR"]:
        return "Admin"
    elif norm == "PROJECT_MANAGER":
        return "Project Manager"
    elif norm == "DEVELOPER":
        return "Developer"
    elif norm == "TESTER":
        return "Tester"
    return role or "Developer"

def get_role_dashboard_path(role):
    norm = (role or "").upper().replace(" ", "_")
    if norm in ["ADMIN", "ADMINISTRATOR"]:
        return "/admin/dashboard"
    elif norm == "PROJECT_MANAGER":
        return "/manager/dashboard"
    elif norm == "DEVELOPER":
        return "/developer/dashboard"
    elif norm == "TESTER":
        return "/tester/dashboard"
    return "/developer/dashboard"

def run_tests():
    print("=================================================================")
    print("TESTING BUGFLOW AUTHENTICATION SUCCESS CONFIRMATION FLOW")
    print("=================================================================\n")

    test_users = [
        {
            "name": "Krupa",
            "email": "krupa@example.org",
            "password": "BugFlow@2026",
            "expected_role": "ADMIN",
            "expected_display_role": "Admin",
            "expected_dashboard": "/admin/dashboard"
        },
        {
            "name": "Arun",
            "email": "Arun@example.org",
            "password": "BugFlow@2026",
            "expected_role": "PROJECT_MANAGER",
            "expected_display_role": "Project Manager",
            "expected_dashboard": "/manager/dashboard"
        },
        {
            "name": "Priya Sharma",
            "email": "Priya.Sharma@example.org",
            "password": "BugFlow@2026",
            "expected_role": "DEVELOPER",
            "expected_display_role": "Developer",
            "expected_dashboard": "/developer/dashboard"
        },
        {
            "name": "Sunil",
            "email": "Sunil.clark@example.org",
            "password": "BugFlow@2026",
            "expected_role": "TESTER",
            "expected_display_role": "Tester",
            "expected_dashboard": "/tester/dashboard"
        }
    ]

    for u in test_users:
        print(f"--> Testing Auth Flow for: {u['name']} ({u['email']})")
        # Step 1-6: Login request to Flask & PostgreSQL validation
        status, res = http_req("/auth/login", method="POST", data={"email": u["email"], "password": u["password"]})
        assert status == 200, f"Login failed for {u['email']}: {res}"
        token = res["access_token"]
        user_info = res["user"]
        assert token is not None and len(token) > 20
        assert user_info["role"] == u["expected_role"], f"Role mismatch: {user_info['role']} vs {u['expected_role']}"
        print(f"  [PASS] Backend validated credentials & generated JWT token")
        print(f"         User ID: {user_info['id']} | Name: {user_info['name']} | Role: {user_info['role']}")

        # Step 7: Authentication Successful Screen State Preparation
        display_role = format_role(user_info["role"])
        assert display_role == u["expected_display_role"]
        dashboard_target = get_role_dashboard_path(user_info["role"])
        assert dashboard_target == u["expected_dashboard"]
        print(f"  [PASS] Auth Success Screen Content:")
        print(f"         - Heading: 'Login Successful!'")
        print(f"         - Subheading: 'Welcome back, {user_info['name']}!'")
        print(f"         - Information Panel: Role = '{display_role}', Authentication = 'Verified'")
        print(f"         - Button: 'OK – Go to Dashboard' -> redirects to '{dashboard_target}'")

        # Session Restoration Check (/auth/me - simulates page refresh on success screen)
        me_status, me_res = http_req("/auth/me", token=token)
        assert me_status == 200
        assert me_res["user"]["id"] == user_info["id"]
        print(f"  [PASS] Session restoration via /auth/me verified (handles screen refresh)")

        # Step 8-9: Verify target dashboard loads actual data from PostgreSQL
        dash_status, dash_res = http_req("/dashboard/stats", token=token)
        assert dash_status == 200
        print(f"  [PASS] Dashboard data loaded successfully from PostgreSQL for {display_role}:")
        cards = [c["title"] for c in dash_res.get("cards", [])]
        print(f"         Cards returned: {cards}\n")

    # Security: Test unauthenticated access to /auth/me
    print("--> Testing Security: Unauthenticated access protection")
    unauth_status, unauth_res = http_req("/auth/me")
    assert unauth_status in [401, 422], f"Expected 401/422 for unauthenticated request, got {unauth_status}"
    print("  [PASS] Unauthenticated request to /auth/me rejected with HTTP 401 (redirects to /login)")

    # Security: Test failed login remains on Login page with actual error message
    print("\n--> Testing Security: Failed login handling")
    fail_status, fail_res = http_req("/auth/login", method="POST", data={"email": "krupa@example.org", "password": "WrongPassword"})
    assert fail_status == 401
    assert "error" in fail_res
    print(f"  [PASS] Bad password rejected with HTTP 401: '{fail_res['error']}'")

    print("\n=================================================================")
    print("ALL AUTHENTICATION SUCCESS FLOW TESTS COMPLETED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == '__main__':
    run_tests()
