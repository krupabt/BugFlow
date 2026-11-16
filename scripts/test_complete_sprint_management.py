import os
import sys
import requests

BASE_URL = "http://127.0.0.1:5000/api"

def login(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "BugFlow@2026"})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    token = res.json().get("access_token") or res.json().get("token")
    return {"Authorization": f"Bearer {token}"}

def main():
    print("=== STARTING COMPLETE SPRINT MANAGEMENT MODULE TEST ===")

    # 1. Admin Login
    admin_headers = login("krupa@example.org", "password")
    print("[PASS] 1. Admin logged in successfully.")

    # 2. Check total baseline sprints
    sprints_res = requests.get(f"{BASE_URL}/sprints", headers=admin_headers)
    assert sprints_res.status_code == 200
    sprints = sprints_res.json()
    baseline_sprint_count = len(sprints)
    print(f"[INFO] Baseline sprint count for Admin: {baseline_sprint_count} sprints.")
    assert baseline_sprint_count == 48, f"Expected 48 sprints, got {baseline_sprint_count}"
    print("[PASS] 2. Baseline exactly 48 sprints confirmed for Admin.")

    # 3. Test PM Login & Scoped Sprints
    pm_headers = login("arun@example.org", "password")
    pm_sprints_res = requests.get(f"{BASE_URL}/sprints", headers=pm_headers)
    assert pm_sprints_res.status_code == 200
    pm_sprints = pm_sprints_res.json()
    print(f"[INFO] PM Arun sees {len(pm_sprints)} sprints for his managed projects.")
    assert len(pm_sprints) < baseline_sprint_count, "PM should not see all company sprints!"
    print("[PASS] 3. Role-based scoping confirmed for Project Manager.")

    # 4. Open an existing sprint & verify details and metrics
    target_sprint = sprints[0]
    target_sprint_id = target_sprint["id"]
    print(f"[INFO] Testing target sprint: {target_sprint_id} - {target_sprint['name']} (Project: {target_sprint['project_id']})")

    detail_res = requests.get(f"{BASE_URL}/sprints/{target_sprint_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert "total_issues" in detail
    assert "completed_issues" in detail
    assert "in_progress_issues" in detail
    assert "remaining_issues" in detail
    assert "progress" in detail
    assert "duration_label" in detail
    print(f"[PASS] 4. Sprint details verified: Total={detail['total_issues']}, Completed={detail['completed_issues']}, InProgress={detail['in_progress_issues']}, Remaining={detail['remaining_issues']}, Progress={detail['progress']}%.")

    # 5. Test Backlog search
    backlog_res = requests.get(f"{BASE_URL}/sprints/{target_sprint_id}/backlog", headers=admin_headers)
    assert backlog_res.status_code == 200
    backlog_issues = backlog_res.json()
    print(f"[INFO] Target sprint backlog has {len(backlog_issues)} eligible project issues.")
    if backlog_issues:
        test_issue = backlog_issues[0]
        search_query = test_issue["id"]
        search_res = requests.get(f"{BASE_URL}/sprints/{target_sprint_id}/backlog?q={search_query}", headers=admin_headers)
        assert search_res.status_code == 200
        found = search_res.json()
        assert any(i["id"] == test_issue["id"] for i in found), f"Search query for {test_issue['id']} did not find the issue"
        print(f"[PASS] 5. Backlog search verified for issue {test_issue['id']}.")

    # 6. Add issue to sprint, test duplicate protection
    if backlog_issues:
        issue_to_add = backlog_issues[0]["id"]
        add_res = requests.post(f"{BASE_URL}/sprints/{target_sprint_id}/issues", json={"issue_id": issue_to_add}, headers=admin_headers)
        assert add_res.status_code == 200, f"Add to sprint failed: {add_res.text}"
        print(f"[PASS] 6. Added issue {issue_to_add} to sprint {target_sprint_id}.")

        # Duplicate protection check
        dup_res = requests.post(f"{BASE_URL}/sprints/{target_sprint_id}/issues", json={"issue_id": issue_to_add}, headers=admin_headers)
        assert dup_res.status_code == 400, "Duplicate sprint assignment should fail with 400!"
        print("[PASS] 7. Duplicate issue assignment safely prevented.")

        # 7. Move issue across the board: Open -> In Progress -> Testing
        move_res = requests.patch(f"{BASE_URL}/sprints/{target_sprint_id}/issues/{issue_to_add}/status", json={"status": "In Progress"}, headers=admin_headers)
        assert move_res.status_code == 200, f"Move to In Progress failed: {move_res.text}"
        print(f"[PASS] 8. Moved issue {issue_to_add} to In Progress on Sprint Board.")

        move_res2 = requests.patch(f"{BASE_URL}/sprints/{target_sprint_id}/issues/{issue_to_add}/status", json={"status": "Testing"}, headers=admin_headers)
        assert move_res2.status_code == 200, f"Move to Testing failed: {move_res2.text}"
        print(f"[PASS] 9. Moved issue {issue_to_add} to Testing on Sprint Board.")

        # Revert issue status to Open
        requests.patch(f"{BASE_URL}/sprints/{target_sprint_id}/issues/{issue_to_add}/status", json={"status": "Open"}, headers=admin_headers)

        # 8. Remove issue from sprint back to backlog
        rem_res = requests.delete(f"{BASE_URL}/sprints/{target_sprint_id}/issues/{issue_to_add}", headers=admin_headers)
        assert rem_res.status_code == 200, f"Remove from sprint failed: {rem_res.text}"
        print(f"[PASS] 10. Removed issue {issue_to_add} from sprint back to backlog.")

    # 9. Test Edit Sprint Information & Date Validation
    invalid_edit = requests.put(f"{BASE_URL}/sprints/{target_sprint_id}", json={
        "start_date": "2026-12-01",
        "end_date": "2026-11-01"  # end before start
    }, headers=admin_headers)
    assert invalid_edit.status_code == 400, "End date earlier than start date should fail with 400!"
    print("[PASS] 11. Edit sprint date validation (end_date < start_date) rejected correctly.")

    orig_goal = detail.get("goal") or ""
    valid_edit = requests.put(f"{BASE_URL}/sprints/{target_sprint_id}", json={
        "goal": "Deliver verified performance improvements for Q4"
    }, headers=admin_headers)
    assert valid_edit.status_code == 200
    assert valid_edit.json()["sprint"]["goal"] == "Deliver verified performance improvements for Q4"
    print("[PASS] 12. Edit sprint goal updated in PostgreSQL.")

    # Restore original goal
    requests.put(f"{BASE_URL}/sprints/{target_sprint_id}", json={"goal": orig_goal}, headers=admin_headers)

    # 10. Test Create Sprint, Validation, & Clean Deletion
    invalid_create = requests.post(f"{BASE_URL}/sprints", json={
        "project_id": target_sprint["project_id"],
        "name": "Invalid Sprint",
        "start_date": "2026-12-15",
        "end_date": "2026-12-01"
    }, headers=admin_headers)
    assert invalid_create.status_code == 400
    print("[PASS] 13. Create sprint validation (end_date < start_date) rejected correctly.")

    valid_create = requests.post(f"{BASE_URL}/sprints", json={
        "project_id": target_sprint["project_id"],
        "name": "E2E Test Sprint SprintX",
        "goal": "Verify sprint creation and deletion cycle",
        "start_date": "2026-12-01",
        "end_date": "2026-12-15"
    }, headers=admin_headers)
    assert valid_create.status_code == 201
    created_sprint = valid_create.json()["sprint"]
    created_sprint_id = created_sprint["id"]
    print(f"[PASS] 14. Created new sprint with ID: {created_sprint_id}.")

    # Delete created sprint to keep exact baseline of 48 sprints
    del_res = requests.delete(f"{BASE_URL}/sprints/{created_sprint_id}", headers=admin_headers)
    assert del_res.status_code == 200
    print(f"[PASS] 15. Cleaned up created sprint {created_sprint_id}.")

    # 11. Test Role Permissions Enforcement on Sprints
    dev_headers = login("Priya.Sharma@example.org", "BugFlow@2026")
    dev_create = requests.post(f"{BASE_URL}/sprints", json={
        "project_id": target_sprint["project_id"],
        "name": "Dev Unauthorized Sprint"
    }, headers=dev_headers)
    assert dev_create.status_code == 403, "Developers must not be allowed to create sprints!"
    print("[PASS] 16. Developer role denied sprint creation with 403 Forbidden.")

    tester_headers = login("Sunil.clark@example.org", "BugFlow@2026")
    tester_create = requests.post(f"{BASE_URL}/sprints", json={
        "project_id": target_sprint["project_id"],
        "name": "Tester Unauthorized Sprint"
    }, headers=tester_headers)
    assert tester_create.status_code == 403, "Testers must not be allowed to create sprints!"
    print("[PASS] 17. Tester role denied sprint creation with 403 Forbidden.")

    # Final count check
    final_sprints_res = requests.get(f"{BASE_URL}/sprints", headers=admin_headers)
    assert len(final_sprints_res.json()) == baseline_sprint_count == 48
    print(f"[PASS] 18. Exactly 48 sprints preserved in PostgreSQL database.")

    print("\n=== ALL SPRINT MANAGEMENT MODULE TESTS PASSED! ===")

if __name__ == "__main__":
    main()
