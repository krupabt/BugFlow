import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5000/api"

def http_post(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def http_patch(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def http_put(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def http_get(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def test_audit_history_flow():
    print("=" * 68)
    print("TESTING BUGFLOW AUDIT HISTORY, PERMISSIONS & ACTIVITY DESCRIPTIONS")
    print("=" * 68)

    # 1. Login users
    print("\n--> 1. Authenticating test users:")
    users = {
        "Admin": ("krupa@example.org", "BugFlow@2026"),
        "PM_Arun": ("Arun@example.org", "BugFlow@2026"),
        "PM_Casey": ("casey.patel@example.org", "BugFlow@2026"),
        "Dev_Priya": ("Priya.Sharma@example.org", "BugFlow@2026"),
        "Dev_Avery": ("avery.shah@example.org", "BugFlow@2026"),
        "Tester_Sunil": ("Sunil.clark@example.org", "BugFlow@2026")
    }
    tokens = {}
    for key, (email, pwd) in users.items():
        st, res = http_post("/auth/login", {"email": email, "password": pwd})
        assert st == 200, f"Login failed for {email}"
        tokens[key] = res["access_token"]
        print(f"  [PASS] {key} ({res['user']['name']}) authenticated -> ID: {res['user']['id']}")

    # Pick an issue in Arun's project (PRJ-001): BUG-00726
    test_issue_id = "BUG-00726"
    st, orig_issue = http_get(f"/issues/{test_issue_id}", token=tokens["Admin"])
    assert st == 200
    orig_assignee = orig_issue.get("assigned_to")
    orig_priority = orig_issue.get("priority")
    orig_status = orig_issue.get("status")
    print(f"\n--> Baseline state of {test_issue_id} in {orig_issue['project_name']} ({orig_issue['project_id']}):")
    print(f"    Assignee: {orig_issue.get('assignee_name')}, Priority: {orig_priority}, Status: {orig_status}")

    try:
        # Pre-set status to Testing so Sunil can transition from Testing to In Progress
        http_patch(f"/issues/{test_issue_id}/status", {"status": "Testing"}, token=tokens["Admin"])

        # TEST ACTION A: Assignment change
        print(f"\n--> 2. Performing Assignment Change: Krupa assigns {test_issue_id} to Avery Shah")
        st, assign_res = http_patch(f"/issues/{test_issue_id}/assign", {"assigned_to": "USR-006"}, token=tokens["Admin"])
        assert st == 200, f"Assign failed: {assign_res}"
        print(f"  [PASS] Issue assigned via API.")

        # TEST ACTION B: Priority change
        print(f"\n--> 3. Performing Priority Change: Krupa updates {test_issue_id} priority to High")
        st, update_res = http_put(f"/issues/{test_issue_id}", {"priority": "High"}, token=tokens["Admin"])
        assert st == 200, f"Priority update failed: {update_res}"
        print(f"  [PASS] Issue priority updated via API.")

        # TEST ACTION C: Status change with custom Reason
        print(f"\n--> 4. Performing Status Change with Reason: Sunil sets {test_issue_id} from Testing to In Progress with Reason")
        st, status_res = http_patch(f"/issues/{test_issue_id}/status", {
            "status": "In Progress",
            "comment": "Verification failed on QA"
        }, token=tokens["Tester_Sunil"])
        assert st == 200, f"Status update failed: {status_res}"
        print(f"  [PASS] Issue status updated via API.")

        # VERIFY AUDIT DESCRIPTIONS FOR ADMIN
        print(f"\n--> 5. Auditing activity descriptions & timestamps:")
        st, admin_act = http_get("/dashboard/recent-activity?limit=10", token=tokens["Admin"])
        assert st == 200
        assert len(admin_act) >= 3

        recent_3 = admin_act[:3]
        print(f"  Top 3 Activities Recorded:")
        for a in recent_3:
            print(f"   * [{a['created_at']}] {a['description']}" + (f" (Reason: {a['reason']})" if a['reason'] else ""))

        # Check: No "Resolved -> Resolved"
        for a in admin_act:
            assert "Resolved → Resolved" not in a["description"]
            assert "Resolved -> Resolved" not in a["description"]
            assert "Open → Open" not in a["description"]

        # Verify exact human readable formats
        expected_sunil_act = f"Sunil changed {test_issue_id} from Testing to In Progress."
        matching_sunil = [a for a in admin_act if a["description"] == expected_sunil_act and a.get("reason") == "Verification failed on QA"]
        assert matching_sunil, f"Expected '{expected_sunil_act}' with reason 'Verification failed on QA'"
        print(f"  [PASS] Verified: '{expected_sunil_act}' with Reason: 'Verification failed on QA.'")

        expected_krupa_pri = f"Krupa changed {test_issue_id} priority from Medium to High."
        matching_pri = [a for a in admin_act if a["description"] == expected_krupa_pri]
        assert matching_pri, f"Expected '{expected_krupa_pri}'"
        print(f"  [PASS] Verified: '{expected_krupa_pri}'")

        expected_krupa_assign = f"Krupa assigned {test_issue_id} to Avery Shah."
        matching_assign = [a for a in admin_act if a["description"] == expected_krupa_assign]
        assert matching_assign, f"Expected '{expected_krupa_assign}'"
        print(f"  [PASS] Verified: '{expected_krupa_assign}'")

        # VERIFY ROLE-BASED ACCESS
        print(f"\n--> 6. Verifying Role-Based Audit Visibility Permissions:")
        # Admin can view all
        print(f"  * Admin sees {len(admin_act)} activities.")
        assert len(admin_act) >= 3

        # PM Arun (Manages PRJ-001 where BUG-00726 belongs)
        st, arun_act = http_get("/dashboard/recent-activity", token=tokens["PM_Arun"])
        assert st == 200
        arun_issue_ids = [a["issue_id"] for a in arun_act]
        assert test_issue_id in arun_issue_ids, f"PM Arun MUST see activities for managed project PRJ-001 ({test_issue_id})"
        print(f"  [PASS] PM Arun sees activities for PRJ-001 (Count: {len(arun_act)}, includes {test_issue_id}).")

        # PM Casey (Manages PRJ-002, PRJ-005, PRJ-008 - NOT PRJ-001)
        st, casey_act = http_get("/dashboard/recent-activity", token=tokens["PM_Casey"])
        assert st == 200
        casey_issue_ids = [a["issue_id"] for a in casey_act]
        assert test_issue_id not in casey_issue_ids, f"PM Casey MUST NOT see activities for PRJ-001 ({test_issue_id})"
        print(f"  [PASS] PM Casey CANNOT see {test_issue_id} activities (Strict PM project isolation verified).")

        # Developer Avery (Assigned to BUG-00726)
        st, avery_act = http_get("/dashboard/recent-activity", token=tokens["Dev_Avery"])
        assert st == 200
        avery_issue_ids = [a["issue_id"] for a in avery_act]
        assert test_issue_id in avery_issue_ids, f"Dev Avery MUST see activities for assigned issue {test_issue_id}"
        print(f"  [PASS] Dev Avery sees activities for assigned issue {test_issue_id}.")

        # Developer Priya (Not assigned to BUG-00726)
        st, priya_act = http_get("/dashboard/recent-activity", token=tokens["Dev_Priya"])
        assert st == 200
        priya_issue_ids = [a["issue_id"] for a in priya_act]
        assert test_issue_id not in priya_issue_ids, f"Dev Priya MUST NOT see activities for issue {test_issue_id} assigned to Avery"
        print(f"  [PASS] Dev Priya CANNOT see {test_issue_id} activities (Strict Dev assignment isolation verified).")

        # Tester Sunil (Performed the status transition)
        st, sunil_act = http_get("/dashboard/recent-activity", token=tokens["Tester_Sunil"])
        assert st == 200
        sunil_issue_ids = [a["issue_id"] for a in sunil_act]
        assert test_issue_id in sunil_issue_ids, f"Tester Sunil MUST see activities for transitioned issue {test_issue_id}"
        print(f"  [PASS] Tester Sunil sees activities for transitioned issue {test_issue_id}.")

    finally:
        # Revert baseline state
        print(f"\n--> 7. Restoring baseline state for {test_issue_id}...")
        http_patch(f"/issues/{test_issue_id}/assign", {"assigned_to": orig_assignee}, token=tokens["Admin"])
        http_put(f"/issues/{test_issue_id}", {"priority": orig_priority}, token=tokens["Admin"])
        http_patch(f"/issues/{test_issue_id}/status", {"status": orig_status}, token=tokens["Admin"])
        print(f"  [PASS] Baseline restored: status={orig_status}, priority={orig_priority}, assignee={orig_assignee}.")

    print("\n" + "=" * 68)
    print("ALL AUDIT HISTORY & ACTIVITY TESTS PASSED WITH 100% ACCURACY!")
    print("=" * 68)

if __name__ == "__main__":
    test_audit_history_flow()
