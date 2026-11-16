import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api"

def login(email, password="BugFlow@2026"):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {email}: {res.status_code} {res.text}")
    data = res.json()
    token = data.get("access_token") or data.get("token")
    return token, data.get("user")

def get_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def run_comprehensive_tests():
    print("=" * 75)
    print("BUGFLOW - DYNAMIC ROLE-BASED ACCESS CONTROL & VISIBILITY SUITE")
    print("=" * 75)

    # -------------------------------------------------------------
    # 1. ADMIN (Krupa - USR-001)
    # -------------------------------------------------------------
    print("\n[TEST 1] Admin Role Visibility (Krupa USR-001)")
    admin_token, admin_user = login("krupa@example.org")
    admin_h = get_headers(admin_token)

    res = requests.get(f"{BASE_URL}/projects", headers=admin_h)
    assert res.status_code == 200
    admin_projects = res.json()
    assert len(admin_projects) == 8, f"Admin should see 8 projects, got {len(admin_projects)}"
    print(f"  [OK] Admin sees all {len(admin_projects)} projects.")

    res = requests.get(f"{BASE_URL}/issues", headers=admin_h)
    assert res.status_code == 200
    admin_issues_total = res.json()["total"]
    assert admin_issues_total >= 730, f"Admin should see at least 730 issues, got {admin_issues_total}"
    print(f"  [OK] Admin sees all {admin_issues_total} issues across all projects.")

    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=admin_h)
    assert res.status_code == 200
    admin_stats = res.json()
    assert admin_stats["status_total"] == admin_issues_total
    print(f"  [OK] Admin dashboard status doughnut total: {admin_stats['status_total']}.")

    # -------------------------------------------------------------
    # 2. MULTIPLE PROJECT MANAGERS (Dynamic Scoping)
    # -------------------------------------------------------------
    print("\n[TEST 2] Project Manager Role Visibility (Dynamic per PM)")
    
    # PM 1: Arun (USR-002) - manages PRJ-001, PRJ-004, PRJ-007
    arun_token, arun_user = login("Arun@example.org")
    arun_h = get_headers(arun_token)

    res = requests.get(f"{BASE_URL}/projects", headers=arun_h)
    assert res.status_code == 200
    arun_projects = res.json()
    arun_pids = set(p["id"] for p in arun_projects)
    assert arun_pids == {"PRJ-001", "PRJ-004", "PRJ-007"}, f"Arun unexpected projects: {arun_pids}"
    print(f"  [OK] PM Arun sees only managed projects: {sorted(list(arun_pids))}")

    # PM 2: Casey Patel (USR-003) - manages PRJ-002, PRJ-005, PRJ-008
    casey_token, casey_user = login("Casey.Patel@example.org")
    casey_h = get_headers(casey_token)

    res = requests.get(f"{BASE_URL}/projects", headers=casey_h)
    assert res.status_code == 200
    casey_projects = res.json()
    casey_pids = set(p["id"] for p in casey_projects)
    assert casey_pids == {"PRJ-002", "PRJ-005", "PRJ-008"}, f"Casey unexpected projects: {casey_pids}"
    print(f"  [OK] PM Casey sees only managed projects: {sorted(list(casey_pids))}")

    # Cross-project authorization check (Arun cannot access PRJ-002, Casey cannot access PRJ-001)
    res = requests.get(f"{BASE_URL}/projects/PRJ-002", headers=arun_h)
    assert res.status_code == 403, f"Arun should be blocked from PRJ-002, got {res.status_code}"
    print("  [OK] Arun direct access to Casey's project PRJ-002 -> 403 Forbidden.")

    res = requests.get(f"{BASE_URL}/projects/PRJ-001", headers=casey_h)
    assert res.status_code == 403, f"Casey should be blocked from PRJ-001, got {res.status_code}"
    print("  [OK] Casey direct access to Arun's project PRJ-001 -> 403 Forbidden.")

    # PM Issues scoping
    res = requests.get(f"{BASE_URL}/issues", headers=arun_h)
    assert res.status_code == 200
    arun_total = res.json()["total"]
    assert arun_total >= 289, f"Arun expected at least 289 issues, got {arun_total}"
    print(f"  [OK] PM Arun sees all {arun_total} issues belonging strictly to Arun's managed projects.")

    res = requests.get(f"{BASE_URL}/issues", headers=casey_h)
    assert res.status_code == 200
    casey_total = res.json()["total"]
    assert casey_total == 257, f"Casey expected 257 issues, got {casey_total}"
    print(f"  [OK] PM Casey sees all {casey_total} issues belonging strictly to Casey's managed projects.")

    # -------------------------------------------------------------
    # 3. MULTIPLE DEVELOPERS (Dynamic Project & Issue Scoping)
    # -------------------------------------------------------------
    print("\n[TEST 3] Developer Role Visibility (Dynamic per Developer)")

    # Developer 1: Priya Sharma (USR-005) - assigned issues in PRJ-001, PRJ-005
    priya_token, priya_user = login("Priya.Sharma@example.org")
    priya_h = get_headers(priya_token)

    res = requests.get(f"{BASE_URL}/projects", headers=priya_h)
    assert res.status_code == 200
    priya_projects = res.json()
    priya_pids = set(p["id"] for p in priya_projects)
    assert priya_pids == {"PRJ-001", "PRJ-005"}, f"Priya expected PRJ-001 & PRJ-005, got {priya_pids}"
    print(f"  [OK] Developer Priya sees only projects containing her assigned issues: {sorted(list(priya_pids))}")

    for p in priya_projects:
        assert "my_assigned_issues" in p and "my_completed_issues" in p
        print(f"    * {p['id']}: my_assigned_issues={p['my_assigned_issues']}, my_completed_issues={p['my_completed_issues']}")

    # Developer 2: Avery Shah (USR-006)
    avery_token, avery_user = login("Avery.Shah@example.org")
    avery_h = get_headers(avery_token)

    res = requests.get(f"{BASE_URL}/projects", headers=avery_h)
    assert res.status_code == 200
    avery_projects = res.json()
    avery_pids = set(p["id"] for p in avery_projects)
    print(f"  [OK] Developer Avery sees {len(avery_projects)} projects where Avery has issues: {sorted(list(avery_pids))}")

    # Developer Issues: strictly assigned_to == user.id
    res = requests.get(f"{BASE_URL}/issues", headers=priya_h)
    assert res.status_code == 200
    priya_issues = res.json()
    assert priya_issues["total"] == 12, f"Priya should have 12 assigned issues, got {priya_issues['total']}"
    for iss in priya_issues["issues"]:
        assert iss["assigned_to"] == "USR-005"
        assert iss["project_id"] in priya_pids
    print(f"  [OK] Developer Priya sees strictly her {priya_issues['total']} assigned issues.")

    # Developer direct access to another developer's issue -> 403
    res = requests.get(f"{BASE_URL}/issues", headers=avery_h)
    avery_issues = res.json()
    avery_sample_issue = avery_issues["issues"][0]["id"]

    res = requests.get(f"{BASE_URL}/issues/{avery_sample_issue}", headers=priya_h)
    assert res.status_code == 403, f"Priya should be 403 Forbidden for Avery's issue {avery_sample_issue}, got {res.status_code}"
    print(f"  [OK] Priya direct URL access to Avery's issue {avery_sample_issue} -> 403 Forbidden.")

    # -------------------------------------------------------------
    # 4. TESTER ROLE (Dynamic Scoping, Tabs & Metrics)
    # -------------------------------------------------------------
    print("\n[TEST 4] Tester Role Visibility (Dynamic per Tester)")

    # Tester 1: Sunil Clark (USR-015)
    sunil_token, sunil_user = login("Sunil.clark@example.org")
    sunil_h = get_headers(sunil_token)

    res = requests.get(f"{BASE_URL}/projects", headers=sunil_h)
    assert res.status_code == 200
    sunil_projects = res.json()
    print(f"  [OK] Tester Sunil sees {len(sunil_projects)} projects containing reported/testing issues.")
    for p in sunil_projects:
        assert "my_reported_issues" in p and "my_verification_issues" in p
        print(f"    * {p['id']}: my_reported={p['my_reported_issues']}, my_verification={p['my_verification_issues']}")

    # Tester Tabs: All, Reported, Tests
    # 4a: All accessible issues
    res = requests.get(f"{BASE_URL}/issues", headers=sunil_h)
    assert res.status_code == 200
    all_data = res.json()
    total_all = all_data["total"]
    reported_count = all_data["reported_count"]
    tests_count = all_data["tests_count"]
    print(f"  [OK] Tester Sunil issue metrics: total={total_all}, reported_count={reported_count}, tests_count={tests_count}")

    # 4b: Tab 1: My Reported Issues
    res = requests.get(f"{BASE_URL}/issues?tester_view=reported", headers=sunil_h)
    assert res.status_code == 200
    rep_data = res.json()
    assert rep_data["total"] == reported_count, f"Expected {reported_count}, got {rep_data['total']}"
    for iss in rep_data["issues"]:
        assert iss.get("reported_by") == "USR-015" or iss.get("created_by") == "USR-015"
    print(f"  [OK] Tester Tab 'My Reported Issues' returns {rep_data['total']} issues, all reported/created by USR-015.")

    # 4c: Tab 2: My Tests (Testing status)
    res = requests.get(f"{BASE_URL}/issues?tester_view=tests", headers=sunil_h)
    assert res.status_code == 200
    tests_data = res.json()
    assert tests_data["total"] == tests_count, f"Expected {tests_count}, got {tests_data['total']}"
    for iss in tests_data["issues"]:
        assert iss.get("status") == "Testing"
    print(f"  [OK] Tester Tab 'My Tests' returns {tests_data['total']} issues, all in 'Testing' status.")

    # -------------------------------------------------------------
    # 5. DYNAMIC REASSIGNMENT INTEGRITY TEST
    # -------------------------------------------------------------
    print("\n[TEST 5] Dynamic Reassignment Integrity Test")
    # Take an issue currently assigned to Avery in PRJ-001
    res = requests.get(f"{BASE_URL}/issues?project_id=PRJ-001&assignee_id=USR-006", headers=admin_h)
    test_issue = res.json()["issues"][0]["id"]
    print(f"  * Selected issue {test_issue} currently assigned to Avery (USR-006).")

    # Baseline counts for Priya and Avery
    res_p_before = requests.get(f"{BASE_URL}/issues", headers=priya_h).json()["total"]
    res_a_before = requests.get(f"{BASE_URL}/issues", headers=avery_h).json()["total"]

    # Reassign to Priya (USR-005)
    patch_res = requests.patch(
        f"{BASE_URL}/issues/{test_issue}/assign",
        headers=admin_h,
        json={"assigned_to": "USR-005"}
    )
    assert patch_res.status_code == 200, f"Assign failed: {patch_res.text}"

    # Verify counts dynamically updated
    res_p_after = requests.get(f"{BASE_URL}/issues", headers=priya_h).json()["total"]
    res_a_after = requests.get(f"{BASE_URL}/issues", headers=avery_h).json()["total"]

    assert res_p_after == res_p_before + 1, f"Priya count should increase by 1: was {res_p_before}, now {res_p_after}"
    assert res_a_after == res_a_before - 1, f"Avery count should decrease by 1: was {res_a_before}, now {res_a_after}"
    print(f"  [OK] Dynamic update confirmed: Priya {res_p_before} -> {res_p_after}, Avery {res_a_before} -> {res_a_after}.")

    # Restore assignment back to Avery (USR-006)
    restore_res = requests.patch(
        f"{BASE_URL}/issues/{test_issue}/assign",
        headers=admin_h,
        json={"assigned_to": "USR-006"}
    )
    assert restore_res.status_code == 200
    res_p_restored = requests.get(f"{BASE_URL}/issues", headers=priya_h).json()["total"]
    assert res_p_restored == res_p_before
    print(f"  [OK] Restored original assignment cleanly: Priya count restored to {res_p_restored}.")

    print("\n" + "=" * 75)
    print("ALL DYNAMIC ROLE-BASED ACCESS CONTROL TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_comprehensive_tests()
