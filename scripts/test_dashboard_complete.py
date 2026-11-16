import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api"

def login(email, password="BugFlow@2026"):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {email}: {res.status_code} - {res.text}")
    data = res.json()
    token = data.get("access_token") or data.get("token")
    return token, data.get("user")

def get_headers(token):
    return {"Authorization": f"Bearer {token}"}

def run_tests():
    print("==================================================")
    print("BUGFLOW DASHBOARD VERIFICATION SUITE")
    print("==================================================")

    # 1. ADMIN ROLE VERIFICATION
    print("\n--- 1. Testing Admin Role (krupa@example.org) ---")
    admin_token, admin_user = login("krupa@example.org")
    admin_headers = get_headers(admin_token)
    print(f"Logged in as Admin: {admin_user.get('name')} ({admin_user.get('role')})")

    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200, f"Dashboard stats failed: {res.status_code} {res.text}"
    admin_stats = res.json()

    # Check 5 Summary Cards
    cards = admin_stats.get("summary_cards", [])
    assert len(cards) == 5, f"Expected 5 summary cards, got {len(cards)}"
    card_titles = [c["title"] for c in cards]
    assert "Total Issues" in card_titles, "Missing Total Issues card"
    assert "Open Issues" in card_titles, "Missing Open Issues card"
    assert "In Progress" in card_titles, "Missing In Progress card"
    assert "Resolved" in card_titles, "Missing Resolved card"
    assert "Closed" in card_titles, "Missing Closed card"
    total_val = next(c["value"] for c in cards if c["title"] == "Total Issues")
    print(f"Admin 5 Summary Cards Verified! Total Issues: {total_val}")

    # Check Current Sprint & Kanban preview
    curr_sprint = admin_stats.get("current_sprint")
    assert curr_sprint is not None, "Missing current_sprint in stats"
    print(f"Current Sprint: {curr_sprint.get('name')} ({curr_sprint.get('status')}) - Total: {curr_sprint.get('total_issues')}, Progress: {curr_sprint.get('progress')}%")
    kanban = curr_sprint.get("kanban", {})
    assert "todo" in kanban and "in_progress" in kanban and "testing" in kanban and "done" in kanban, "Missing Kanban columns"
    print(f"Kanban counts: To Do={len(kanban['todo'])}, In Progress={len(kanban['in_progress'])}, Testing={len(kanban['testing'])}, Done={len(kanban['done'])}")

    # Check Available Sprints
    avail_sprints = admin_stats.get("available_sprints", [])
    assert len(avail_sprints) > 0, "No available sprints returned for switcher"
    print(f"Available sprints for switcher: {len(avail_sprints)} sprints")

    # Check Recent Activity
    res_act = requests.get(f"{BASE_URL}/dashboard/recent-activity", headers=admin_headers)
    assert res_act.status_code == 200, f"Recent activity failed: {res_act.status_code}"
    admin_activities = res_act.json()
    assert len(admin_activities) > 0, "Expected real activities from PostgreSQL"
    print(f"Admin recent activities retrieved: {len(admin_activities)} events (latest: {admin_activities[0].get('description')})")

    # Check Recent Comments & Attachments
    res_comm = requests.get(f"{BASE_URL}/dashboard/recent-comments", headers=admin_headers)
    assert res_comm.status_code == 200, f"Recent comments failed: {res_comm.status_code}"
    res_att = requests.get(f"{BASE_URL}/dashboard/recent-attachments", headers=admin_headers)
    assert res_att.status_code == 200, f"Recent attachments failed: {res_att.status_code}"
    print(f"Admin recent comments & attachments endpoints OK")

    # 2. PROJECT MANAGER ROLE VERIFICATION
    print("\n--- 2. Testing Project Manager Role (Arun@example.org) ---")
    pm_token, pm_user = login("Arun@example.org")
    pm_headers = get_headers(pm_token)
    print(f"Logged in as PM: {pm_user.get('name')} ({pm_user.get('role')})")

    res_pm = requests.get(f"{BASE_URL}/dashboard/stats", headers=pm_headers)
    assert res_pm.status_code == 200
    pm_stats = res_pm.json()
    pm_cards = pm_stats.get("summary_cards", [])
    pm_total = next(c["value"] for c in pm_cards if c["title"] == "Total Issues")
    print(f"PM Scoped Total Issues: {pm_total} (must be strictly scoped to managed projects, < 731)")
    assert pm_total < 731, f"PM should have scoped issues, got {pm_total}"
    assert len(pm_cards) == 5, "Expected 5 summary cards for PM"

    res_pm_act = requests.get(f"{BASE_URL}/dashboard/recent-activity", headers=pm_headers)
    assert res_pm_act.status_code == 200
    print(f"PM Scoped recent activity events: {len(res_pm_act.json())}")

    # 3. DEVELOPER ROLE VERIFICATION
    print("\n--- 3. Testing Developer Role (Priya.Sharma@example.org) ---")
    dev_token, dev_user = login("Priya.Sharma@example.org")
    dev_headers = get_headers(dev_token)
    print(f"Logged in as Developer: {dev_user.get('name')} ({dev_user.get('role')})")

    res_dev = requests.get(f"{BASE_URL}/dashboard/stats", headers=dev_headers)
    assert res_dev.status_code == 200
    dev_stats = res_dev.json()
    dev_cards = dev_stats.get("summary_cards", [])
    dev_total = next(c["value"] for c in dev_cards if c["title"] == "Total Issues")
    print(f"Developer Scoped Assigned Issues: {dev_total}")
    assert dev_total <= 50, f"Developer should only see assigned issues, got {dev_total}"

    # Developer issues list in table
    res_dev_issues = requests.get(f"{BASE_URL}/issues?page=1&per_page=6", headers=dev_headers)
    assert res_dev_issues.status_code == 200
    dev_issues_data = res_dev_issues.json()
    assert dev_issues_data.get("total") == dev_total, "Issues endpoint total matches developer assigned count"
    print(f"Developer Issues Table API matches dashboard stats exactly ({dev_issues_data.get('total')})")

    # 4. TESTER ROLE VERIFICATION
    print("\n--- 4. Testing Tester Role (Sunil.clark@example.org) ---")
    tester_token, tester_user = login("Sunil.clark@example.org")
    tester_headers = get_headers(tester_token)
    print(f"Logged in as Tester: {tester_user.get('name')} ({tester_user.get('role')})")

    res_tester = requests.get(f"{BASE_URL}/dashboard/stats", headers=tester_headers)
    assert res_tester.status_code == 200
    tester_stats = res_tester.json()
    tester_cards = tester_stats.get("summary_cards", [])
    tester_total = next(c["value"] for c in tester_cards if c["title"] == "Total Issues")
    print(f"Tester Scoped Issues: {tester_total}")
    assert len(tester_cards) == 5, "Expected 5 summary cards for Tester"

    # 5. SPRINT SWITCHER DYNAMIC TEST
    print("\n--- 5. Testing Sprint Switcher Query Param ---")
    if avail_sprints:
        test_sprint_id = avail_sprints[0]["id"]
        res_sw = requests.get(f"{BASE_URL}/dashboard/stats?sprint_id={test_sprint_id}", headers=admin_headers)
        assert res_sw.status_code == 200
        sw_data = res_sw.json()
        assert sw_data.get("current_sprint", {}).get("id") == test_sprint_id, "Sprint switcher did not load requested sprint"
        print(f"Successfully switched sprint to {test_sprint_id} dynamically!")

    # 6. DATABASE INTEGRITY CHECK
    print("\n--- 6. Verifying PostgreSQL Integrity ---")
    import sys
    sys.path.insert(0, 'backend')
    from app import create_app
    from extensions import db
    from models.issue import Issue
    from models.sprint import Sprint
    from models.project import Project
    from models.user import User

    flask_app = create_app()
    with flask_app.app_context():
        issue_cnt = Issue.query.count()
        sprint_cnt = Sprint.query.count()
        proj_cnt = Project.query.count()
        user_cnt = User.query.count()
        print(f"Database Records: Issues={issue_cnt}, Sprints={sprint_cnt}, Projects={proj_cnt}, Users={user_cnt}")
        assert issue_cnt == 731, f"Expected 731 issues, got {issue_cnt}"
        assert sprint_cnt == 48, f"Expected 48 sprints, got {sprint_cnt}"
        assert proj_cnt == 8, f"Expected 8 projects, got {proj_cnt}"
        assert user_cnt == 20, f"Expected 20 users, got {user_cnt}"

    print("\n==================================================")
    print("ALL DASHBOARD TESTS PASSED SUCCESSFULLY (100% OK)")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
