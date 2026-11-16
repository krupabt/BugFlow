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

def run_tests():
    print("=" * 70)
    print("BUGFLOW ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION SUITE")
    print("=" * 70)

    # 1. ADMIN (Krupa - USR-001)
    print("\n[1] Testing Admin (Krupa - krupa@example.org)...")
    krupa_token, krupa_user = login("krupa@example.org")
    headers_krupa = {"Authorization": f"Bearer {krupa_token}"}

    # Projects
    res = requests.get(f"{BASE_URL}/projects", headers=headers_krupa)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    admin_projects = res.json()
    print(f"  [OK] Admin sees all {len(admin_projects)} projects (PRJ-001 through PRJ-008)")
    assert len(admin_projects) == 8, f"Expected 8 projects, got {len(admin_projects)}"

    # Issues
    res = requests.get(f"{BASE_URL}/issues?per_page=100", headers=headers_krupa)
    assert res.status_code == 200
    admin_issues = res.json()
    print(f"  [OK] Admin total issues: {admin_issues['total']} (All system issues)")
    assert admin_issues['total'] == 730, f"Expected 730 issues, got {admin_issues['total']}"

    # Dashboard Stats
    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers_krupa)
    assert res.status_code == 200
    admin_stats = res.json()
    assert admin_stats['status_total'] == 730
    print(f"  [OK] Admin dashboard status doughnut total: {admin_stats['status_total']}")

    # 2. PROJECT MANAGER (Arun - USR-002)
    print("\n[2] Testing Project Manager (Arun - Arun@example.org)...")
    arun_token, arun_user = login("Arun@example.org")
    headers_arun = {"Authorization": f"Bearer {arun_token}"}

    # Projects: Only managed projects
    res = requests.get(f"{BASE_URL}/projects", headers=headers_arun)
    assert res.status_code == 200
    arun_projects = res.json()
    arun_pids = [p['id'] for p in arun_projects]
    print(f"  [OK] Arun sees {len(arun_projects)} projects: {arun_pids}")
    assert set(arun_pids) == {"PRJ-001", "PRJ-004", "PRJ-007"}, f"Unexpected projects: {arun_pids}"

    # Direct access to managed project PRJ-001
    res = requests.get(f"{BASE_URL}/projects/PRJ-001", headers=headers_arun)
    assert res.status_code == 200, f"Expected 200 for PRJ-001, got {res.status_code}"
    print("  [OK] Arun direct URL access to managed project PRJ-001 -> 200 OK")

    # Direct access to unassigned project PRJ-002 (Hospital Management - managed by Casey Patel)
    res = requests.get(f"{BASE_URL}/projects/PRJ-002", headers=headers_arun)
    assert res.status_code == 403, f"Expected 403 for PRJ-002, got {res.status_code}"
    print("  [OK] Arun direct URL access to unmanaged project PRJ-002 -> 403 Forbidden (BLOCKED)")

    # Issues: Only issues in managed projects (PRJ-001, PRJ-004, PRJ-007)
    res = requests.get(f"{BASE_URL}/issues?per_page=100", headers=headers_arun)
    assert res.status_code == 200
    arun_issues = res.json()
    print(f"  [OK] Arun total issues visible: {arun_issues['total']} (Belonging to Arun's 3 projects)")
    assert arun_issues['total'] == 289, f"Expected 289 issues for Arun, got {arun_issues['total']}"
    for issue in arun_issues['issues']:
        assert issue['project_id'] in arun_pids, f"Issue {issue['id']} belongs to {issue['project_id']} not in {arun_pids}"

    # Direct access to issue in Arun's project
    sample_arun_issue = arun_issues['issues'][0]['id']
    res = requests.get(f"{BASE_URL}/issues/{sample_arun_issue}", headers=headers_arun)
    assert res.status_code == 200
    print(f"  [OK] Arun direct URL access to {sample_arun_issue} in {arun_issues['issues'][0]['project_id']} -> 200 OK")

    # Find an issue belonging to PRJ-002 (Casey Patel)
    res = requests.get(f"{BASE_URL}/issues?project_id=PRJ-002", headers=headers_krupa)
    casey_issue_id = res.json()['issues'][0]['id']
    
    # Direct access to Casey's issue
    res = requests.get(f"{BASE_URL}/issues/{casey_issue_id}", headers=headers_arun)
    assert res.status_code == 403, f"Expected 403 for {casey_issue_id}, got {res.status_code}"
    print(f"  [OK] Arun direct URL access to unmanaged issue {casey_issue_id} -> 403 Forbidden (BLOCKED)")

    # Dashboard Stats
    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers_arun)
    assert res.status_code == 200
    arun_stats = res.json()
    assert arun_stats['status_total'] == 289
    print(f"  [OK] Arun dashboard status doughnut total: {arun_stats['status_total']} (Matches managed projects)")

    # Reports RBAC
    res = requests.get(f"{BASE_URL}/reports?project_id=PRJ-001", headers=headers_arun)
    assert res.status_code == 200
    print("  [OK] Arun reports for PRJ-001 -> 200 OK")

    res = requests.get(f"{BASE_URL}/reports?project_id=PRJ-002", headers=headers_arun)
    assert res.status_code == 403
    print("  [OK] Arun reports for PRJ-002 -> 403 Forbidden (BLOCKED)")

    # 3. DEVELOPER (Priya Sharma - USR-005)
    print("\n[3] Testing Developer (Priya Sharma - Priya.Sharma@example.org)...")
    priya_token, priya_user = login("Priya.Sharma@example.org")
    headers_priya = {"Authorization": f"Bearer {priya_token}"}

    # Projects: Only projects where Priya has assigned issues (PRJ-001, PRJ-005)
    res = requests.get(f"{BASE_URL}/projects", headers=headers_priya)
    assert res.status_code == 200
    priya_projects = res.json()
    priya_pids = [p['id'] for p in priya_projects]
    print(f"  [OK] Priya sees {len(priya_projects)} projects: {priya_pids}")
    assert set(priya_pids) == {"PRJ-001", "PRJ-005"}, f"Expected only PRJ-001 and PRJ-005, got {priya_pids}"

    # Verify Developer-specific fields: my_assigned_issues, my_completed_issues
    for p in priya_projects:
        assert "my_assigned_issues" in p, f"my_assigned_issues missing in project {p['id']}"
        assert "my_completed_issues" in p, f"my_completed_issues missing in project {p['id']}"
        print(f"       * {p['id']} ({p['name']}): My Assigned = {p['my_assigned_issues']}, My Completed = {p['my_completed_issues']}")
    
    # Direct access to assigned project PRJ-001
    res = requests.get(f"{BASE_URL}/projects/PRJ-001", headers=headers_priya)
    assert res.status_code == 200
    print("  [OK] Priya direct URL access to assigned project PRJ-001 -> 200 OK")

    # Direct access to assigned project PRJ-005
    res = requests.get(f"{BASE_URL}/projects/PRJ-005", headers=headers_priya)
    assert res.status_code == 200
    print("  [OK] Priya direct URL access to assigned project PRJ-005 -> 200 OK")

    # Direct access to unrelated project PRJ-002
    res = requests.get(f"{BASE_URL}/projects/PRJ-002", headers=headers_priya)
    assert res.status_code == 403, f"Expected 403 for PRJ-002, got {res.status_code}"
    print("  [OK] Priya direct URL access to unrelated project PRJ-002 -> 403 Forbidden (BLOCKED)")

    # Direct access to unrelated project PRJ-003
    res = requests.get(f"{BASE_URL}/projects/PRJ-003", headers=headers_priya)
    assert res.status_code == 403, f"Expected 403 for PRJ-003, got {res.status_code}"
    print("  [OK] Priya direct URL access to unrelated project PRJ-003 -> 403 Forbidden (BLOCKED)")

    # Issues: Only assigned to Priya (12 issues in PRJ-001 and PRJ-005)
    res = requests.get(f"{BASE_URL}/issues?per_page=100", headers=headers_priya)
    assert res.status_code == 200
    priya_issues = res.json()
    print(f"  [OK] Priya total visible issues: {priya_issues['total']} (Only assigned to Priya)")
    assert priya_issues['total'] == 12, f"Expected 12 assigned issues for Priya, got {priya_issues['total']}"
    for issue in priya_issues['issues']:
        assert issue['assigned_to'] == "USR-005", f"Issue {issue['id']} assigned to {issue['assigned_to']}"
        assert issue['project_id'] in {"PRJ-001", "PRJ-005"}, f"Issue {issue['id']} in project {issue['project_id']}"

    # Direct access to Priya's issue
    priya_issue_id = priya_issues['issues'][0]['id']
    res = requests.get(f"{BASE_URL}/issues/{priya_issue_id}", headers=headers_priya)
    assert res.status_code == 200
    print(f"  [OK] Priya direct URL access to her assigned issue {priya_issue_id} -> 200 OK")

    # Direct access to someone else's issue
    res = requests.get(f"{BASE_URL}/issues/{casey_issue_id}", headers=headers_priya)
    assert res.status_code == 403, f"Expected 403 for {casey_issue_id}, got {res.status_code}"
    print(f"  [OK] Priya direct URL access to another developer's issue {casey_issue_id} -> 403 Forbidden (BLOCKED)")

    # Dashboard Stats
    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers_priya)
    assert res.status_code == 200
    priya_stats = res.json()
    assert priya_stats['status_total'] == 12
    print(f"  [OK] Priya dashboard doughnut total: {priya_stats['status_total']} (Matches assigned issues: 12)")

    # 4. TESTER (Sunil - USR-015)
    print("\n[4] Testing Tester (Sunil - Sunil.clark@example.org)...")
    sunil_token, sunil_user = login("Sunil.clark@example.org")
    headers_sunil = {"Authorization": f"Bearer {sunil_token}"}

    # Issues: Only reported by Sunil, created by Sunil, or in Testing
    res = requests.get(f"{BASE_URL}/issues?per_page=100", headers=headers_sunil)
    assert res.status_code == 200
    sunil_issues = res.json()
    print(f"  [OK] Sunil total visible issues: {sunil_issues['total']} (Reported/Created/Testing)")
    assert sunil_issues['total'] == 144, f"Expected 144 relevant issues for Sunil, got {sunil_issues['total']}"

    # Direct access to Sunil's issue
    sunil_issue_id = sunil_issues['issues'][0]['id']
    res = requests.get(f"{BASE_URL}/issues/{sunil_issue_id}", headers=headers_sunil)
    assert res.status_code == 200
    print(f"  [OK] Sunil direct URL access to relevant issue {sunil_issue_id} -> 200 OK")

    # Direct access to unrelated issue
    # Find an issue not reported by Sunil and not in Testing and not created by Sunil
    res = requests.get(f"{BASE_URL}/issues?status=Resolved", headers=headers_krupa)
    unrelated_id = None
    for iss in res.json()['issues']:
        if iss.get('reported_by') != "USR-015" and iss.get('created_by') != "USR-015" and iss.get('status') != "Testing":
            unrelated_id = iss['id']
            break
    
    assert unrelated_id is not None
    res = requests.get(f"{BASE_URL}/issues/{unrelated_id}", headers=headers_sunil)
    assert res.status_code == 403, f"Expected 403 for {unrelated_id}, got {res.status_code}"
    print(f"  [OK] Sunil direct URL access to unrelated issue {unrelated_id} -> 403 Forbidden (BLOCKED)")

    # Dashboard Stats
    res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers_sunil)
    assert res.status_code == 200
    sunil_stats = res.json()
    assert sunil_stats['status_total'] == 144
    print(f"  [OK] Sunil dashboard doughnut total: {sunil_stats['status_total']} (Matches relevant issues)")

    print("\n" + "=" * 70)
    print("ALL ROLE-BASED ACCESS CONTROL VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
