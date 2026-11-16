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

def run_tests():
    print("=" * 75)
    print("BUGFLOW - SPRINT MANAGEMENT & RBAC VERIFICATION SUITE")
    print("=" * 75)

    # 1. ADMIN (Krupa - USR-001)
    print("\n[TEST 1] Admin Sprints Access & Visibility (Krupa USR-001)")
    admin_token, admin_user = login("krupa@example.org")
    admin_h = get_headers(admin_token)

    res = requests.get(f"{BASE_URL}/sprints", headers=admin_h)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    admin_sprints = res.json()
    print(f"  [OK] Admin retrieves all {len(admin_sprints)} sprints across all projects.")
    assert len(admin_sprints) == 48, f"Expected 48 sprints, got {len(admin_sprints)}"

    # Check sprint structure and fields
    sample_sp = admin_sprints[0]
    required_fields = ["id", "sprint_name", "project_id", "project_name", "start_date", "end_date", "status", "issue_count", "progress"]
    for rf in required_fields:
        assert rf in sample_sp, f"Field '{rf}' missing in sprint response"
    print(f"  [OK] Sprint data contains all required fields: {list(sample_sp.keys())}")
    print(f"  [OK] Sample Sprint: ID={sample_sp['id']}, Name='{sample_sp['sprint_name']}', Project={sample_sp['project_name']}, Issues={sample_sp['issue_count']}, Progress={sample_sp['progress']}%")

    # Verify original IDs preserved
    original_sample_ids = {"SP-01-01", "SP-02-01", "SP-03-01", "SP-04-01", "SP-05-01", "SP-06-01", "SP-07-01", "SP-08-01"}
    retrieved_ids = set(s["id"] for s in admin_sprints)
    for oid in original_sample_ids:
        assert oid in retrieved_ids, f"Original sprint ID {oid} not found in database!"
    print(f"  [OK] Original sprint IDs preserved (all 48 intact).")

    # 2. PROJECT MANAGERS (Arun vs Casey)
    print("\n[TEST 2] Project Manager Sprints Scoping & Permission Enforcement")
    # PM 1: Arun (USR-002) - manages PRJ-001, PRJ-004, PRJ-007
    arun_token, arun_user = login("Arun@example.org")
    arun_h = get_headers(arun_token)

    res = requests.get(f"{BASE_URL}/sprints", headers=arun_h)
    assert res.status_code == 200
    arun_sprints = res.json()
    arun_sprint_pids = set(s["project_id"] for s in arun_sprints)
    print(f"  [OK] PM Arun sees {len(arun_sprints)} sprints strictly belonging to managed projects: {sorted(list(arun_sprint_pids))}")
    assert arun_sprint_pids == {"PRJ-001", "PRJ-004", "PRJ-007"}, f"Unexpected sprint project IDs: {arun_sprint_pids}"

    # PM 2: Casey Patel (USR-003) - manages PRJ-002, PRJ-005, PRJ-008
    casey_token, casey_user = login("Casey.Patel@example.org")
    casey_h = get_headers(casey_token)

    res = requests.get(f"{BASE_URL}/sprints", headers=casey_h)
    assert res.status_code == 200
    casey_sprints = res.json()
    casey_sprint_pids = set(s["project_id"] for s in casey_sprints)
    print(f"  [OK] PM Casey sees {len(casey_sprints)} sprints strictly belonging to managed projects: {sorted(list(casey_sprint_pids))}")
    assert casey_sprint_pids == {"PRJ-002", "PRJ-005", "PRJ-008"}, f"Unexpected sprint project IDs: {casey_sprint_pids}"

    # 3. CROSS-ACCESS AUTHORIZATION CHECKS (HTTP 403)
    print("\n[TEST 3] Cross-Project Sprint Access Restrictions (Backend Enforcement)")
    # Arun direct access to Casey's sprint SP-02-01 (in PRJ-002)
    res = requests.get(f"{BASE_URL}/sprints/SP-02-01", headers=arun_h)
    assert res.status_code == 403, f"Expected 403 Forbidden for Arun accessing Casey's sprint SP-02-01, got {res.status_code}"
    print("  [OK] PM Arun direct access to unmanaged sprint SP-02-01 -> 403 Forbidden.")

    # Casey direct access to Arun's sprint SP-01-01 (in PRJ-001)
    res = requests.get(f"{BASE_URL}/sprints/SP-01-01", headers=casey_h)
    assert res.status_code == 403, f"Expected 403 Forbidden for Casey accessing Arun's sprint SP-01-01, got {res.status_code}"
    print("  [OK] PM Casey direct access to unmanaged sprint SP-01-01 -> 403 Forbidden.")

    # Arun query with filter project_id=PRJ-002 (unmanaged project)
    res = requests.get(f"{BASE_URL}/sprints?project_id=PRJ-002", headers=arun_h)
    assert res.status_code == 403, f"Expected 403 Forbidden for Arun querying PRJ-002 sprints, got {res.status_code}"
    print("  [OK] PM Arun filter query for unmanaged project PRJ-002 -> 403 Forbidden.")

    # Arun attempt to update status of Casey's sprint SP-02-01
    res = requests.patch(f"{BASE_URL}/sprints/SP-02-01/status", headers=arun_h, json={"status": "ACTIVE"})
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    print("  [OK] PM Arun attempt to update status of Casey's sprint SP-02-01 -> 403 Forbidden.")

    # 4. DEVELOPER RESTRICTIONS
    print("\n[TEST 4] Developer Role Sprint Modification Restrictions")
    dev_token, dev_user = login("Priya.Sharma@example.org")
    dev_h = get_headers(dev_token)

    # Developer attempt to create sprint -> 403
    res = requests.post(f"{BASE_URL}/sprints", headers=dev_h, json={"project_id": "PRJ-001", "name": "Unauthorized Sprint"})
    assert res.status_code == 403, f"Expected 403 for Developer creating sprint, got {res.status_code}"
    print("  [OK] Developer attempt to create sprint -> 403 Forbidden.")

    # Developer attempt to update sprint status -> 403
    res = requests.patch(f"{BASE_URL}/sprints/SP-01-01/status", headers=dev_h, json={"status": "ACTIVE"})
    assert res.status_code == 403, f"Expected 403 for Developer updating sprint status, got {res.status_code}"
    print("  [OK] Developer attempt to update sprint status -> 403 Forbidden.")

    # 5. SPRINT STATUS TRANSITIONS BY AUTHORIZED PM AND ADMIN
    print("\n[TEST 5] Authorized Sprint Status Transitions & Progress Verification")
    # PM Arun updates status of SP-01-01 in PRJ-001
    initial_status = requests.get(f"{BASE_URL}/sprints/SP-01-01", headers=admin_h).json()["status"]
    
    # Change to ACTIVE
    res = requests.patch(f"{BASE_URL}/sprints/SP-01-01/status", headers=arun_h, json={"status": "ACTIVE"})
    assert res.status_code == 200, f"Expected 200 for Arun updating SP-01-01, got {res.status_code}"
    assert res.json()["sprint"]["status"] == "ACTIVE"
    print(f"  [OK] PM Arun successfully updated status of SP-01-01 to ACTIVE.")

    # Admin updates SP-01-01 back to initial status
    res = requests.patch(f"{BASE_URL}/sprints/SP-01-01/status", headers=admin_h, json={"status": initial_status})
    assert res.status_code == 200
    assert res.json()["sprint"]["status"] == initial_status
    print(f"  [OK] Admin successfully restored status of SP-01-01 to {initial_status}.")

    # Verify progress calculation logic
    for sp in admin_sprints[:5]:
        total_i = sp["issue_count"]
        comp_i = sp["completed_issues"]
        calc_progress = round((comp_i / total_i * 100), 1) if total_i > 0 else 0.0
        assert sp["progress"] == calc_progress, f"Mismatch in progress for {sp['id']}: reported {sp['progress']}, expected {calc_progress}"
        print(f"  [OK] Sprint {sp['id']} progress verified: {comp_i}/{total_i} completed ({sp['progress']}%)")

    # Verify total sprints count remains 48
    final_count = requests.get(f"{BASE_URL}/sprints", headers=admin_h).json()
    assert len(final_count) == 48, f"Expected 48 sprints preserved, found {len(final_count)}"
    print(f"  [OK] Database verification: exactly 48 sprints preserved in PostgreSQL.")

    print("\n" + "=" * 75)
    print("ALL SPRINT MANAGEMENT AND RBAC VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
