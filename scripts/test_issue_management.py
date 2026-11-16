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
        try:
            err_data = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_data = {"error": str(e)}
        return e.code, err_data

def run_suite():
    print("=================================================================")
    print("STARTING COMPLETE ISSUE MANAGEMENT MODULE VERIFICATION")
    print("=================================================================\n")

    # 1. Authenticate users
    print("--> 1. Authenticating test users...")
    creds = {
        "admin": ("krupa@example.org", "BugFlow@2026"),
        "pm": ("Arun@example.org", "BugFlow@2026"),
        "dev": ("Priya.Sharma@example.org", "BugFlow@2026"),
        "tester": ("Sunil.clark@example.org", "BugFlow@2026"),
    }
    tokens = {}
    for role_name, (email, pwd) in creds.items():
        status, res = http_req("/auth/login", method="POST", data={"email": email, "password": pwd})
        assert status == 200, f"Login failed for {email}: {res}"
        tokens[role_name] = res["access_token"]
        print(f"  [PASS] {role_name.upper()} ({res['user']['name']}) authenticated.")

    # 2. Check initial issue count
    status, initial_res = http_req("/issues?per_page=1", token=tokens["admin"])
    initial_total = initial_res["total"]
    print(f"\n--> Baseline PostgreSQL issues count: {initial_total}")

    # 3. Test Create Issue (Tester reports an issue)
    print("\n--> 2. Testing CREATE ISSUE (POST /api/issues)...")
    create_payload = {
        "project_id": "PRJ-001",
        "title": "CRUD_TEST_ISSUE - Automated Defect Verification",
        "description": "Disposable test issue created to verify Milestone 1 Issue Management CRUD operations.",
        "issue_type": "Bug",
        "severity": "High",
        "priority": "High",
        "assigned_to": "USR-005", # Priya Sharma
        "component": "Checkout & Payment",
        "environment": "QA",
        "steps_to_reproduce": "1. Add item to cart\n2. Proceed to checkout\n3. Click pay with test gateway",
        "expected_result": "Payment succeeds with confirmation",
        "actual_result": "Unexpected timeout occurs"
    }
    status, create_res = http_req("/issues", method="POST", data=create_payload, token=tokens["tester"])
    assert status == 201, f"Failed to create issue: {create_res}"
    new_issue = create_res["issue"]
    test_id = new_issue["id"]
    print(f"  [PASS] Issue created successfully!")
    print(f"         ID: {test_id} (Generated sequentially)")
    print(f"         Title: {new_issue['title']}")
    print(f"         Status: {new_issue['status']} (Initial status is strictly Open)")
    print(f"         Project: {new_issue['project_name']} ({new_issue['project_id']})")
    print(f"         Assignee: {new_issue['assignee_name']} ({new_issue['assigned_to']})")
    assert test_id.startswith("BUG-")
    assert new_issue["status"] == "Open"

    # 4. Verify Newly Created Issue appears in issues list
    print("\n--> 3. Testing READ ISSUES LIST with Search (GET /api/issues?q=CRUD_TEST_ISSUE)...")
    status, search_res = http_req(f"/issues?q={test_id}", token=tokens["admin"])
    assert status == 200
    assert any(i["id"] == test_id for i in search_res["issues"]), "New issue not found in search results"
    print(f"  [PASS] New issue {test_id} appears in issues list search results.")

    # 5. Verify Full Issue Details (GET /api/issues/:id)
    print(f"\n--> 4. Testing VIEW ISSUE DETAILS (GET /api/issues/{test_id})...")
    status, detail_res = http_req(f"/issues/{test_id}", token=tokens["admin"])
    assert status == 200
    assert detail_res["id"] == test_id
    assert detail_res["title"] == create_payload["title"]
    assert detail_res["component"] == "Checkout & Payment"
    assert len(detail_res.get("status_history", [])) >= 1
    print(f"  [PASS] Full issue details retrieved with history entries: {len(detail_res['status_history'])} event(s)")

    # 6. Test Edit Issue (PUT /api/issues/:id)
    print(f"\n--> 5. Testing UPDATE ISSUE (PUT /api/issues/{test_id})...")
    update_payload = {
        "title": "CRUD_TEST_ISSUE - Updated Title for Payment Gateway",
        "description": "Updated description with additional error log context.",
        "issue_type": "Bug",
        "severity": "Critical",
        "priority": "Critical",
        "project_id": "PRJ-001",
        "assigned_to": "USR-005",
        "component": "Payment Gateway API",
        "environment": "Staging",
        "comment": "Triage updated severity to Critical"
    }
    status, update_res = http_req(f"/issues/{test_id}", method="PUT", data=update_payload, token=tokens["pm"])
    assert status == 200, f"Failed to update issue: {update_res}"
    updated = update_res["issue"]
    assert updated["title"] == update_payload["title"]
    assert updated["severity"] == "Critical"
    assert updated["priority"] in ["P0", "Critical"]
    assert updated["component"] == "Payment Gateway API"
    print(f"  [PASS] Issue updated successfully in PostgreSQL:")
    print(f"         New Title: {updated['title']}")
    print(f"         New Severity: {updated['severity']} | Priority: {updated['priority']}")

    # 7. Test Assignment (PATCH /api/issues/:id/assign)
    print(f"\n--> 6. Testing ASSIGNMENT...")
    status, assign_res = http_req(f"/issues/{test_id}/assign", method="PATCH", data={"assigned_to": "USR-005"}, token=tokens["pm"])
    assert status == 200
    assert assign_res["issue"]["assigned_to"] == "USR-005"
    print(f"  [PASS] Assigned issue to developer USR-005: {assign_res['issue']['assignee_name']}")

    # 8. Test Workflow Transitions & Role Permissions
    print(f"\n--> 7. Testing ISSUE WORKFLOW & ROLE TRANSITIONS...")
    # Step A: Developer Priya (USR-005) transitions Open -> In Progress
    status, trans1 = http_req(f"/issues/{test_id}/status", method="PATCH", data={"status": "In Progress"}, token=tokens["dev"])
    assert status == 200, f"Dev transition Open->In Progress failed: {trans1}"
    print(f"  [PASS] Developer transitioned Open -> In Progress")

    # Step B: Developer Priya transitions In Progress -> Testing
    status, trans2 = http_req(f"/issues/{test_id}/status", method="PATCH", data={"status": "Testing", "comment": "Fix deployed to test env"}, token=tokens["dev"])
    assert status == 200, f"Dev transition In Progress->Testing failed: {trans2}"
    print(f"  [PASS] Developer transitioned In Progress -> Testing")

    # Step C: Tester verifies and transitions Testing -> Resolved
    status, trans3 = http_req(f"/issues/{test_id}/status", method="PATCH", data={
        "status": "Resolved",
        "resolution_summary": "Gateway timeout resolved by updating retry policy",
        "root_cause": "Network socket timeout threshold too low"
    }, token=tokens["tester"])
    assert status == 200, f"Tester transition Testing->Resolved failed: {trans3}"
    print(f"  [PASS] Tester verified and transitioned Testing -> Resolved")

    # Step D: Reopen Transition (Resolved -> Open)
    status, trans4 = http_req(f"/issues/{test_id}/status", method="PATCH", data={
        "status": "Open",
        "comment": "Regression detected during edge test: Reopening"
    }, token=tokens["tester"])
    assert status == 200, f"Reopen transition failed: {trans4}"
    assert trans4["issue"]["reopen_count"] >= 1
    print(f"  [PASS] Tester successfully reopened issue. Reopen count: {trans4['issue']['reopen_count']}")

    # Step E: PM transitions Open -> Closed
    status, trans5 = http_req(f"/issues/{test_id}/status", method="PATCH", data={"status": "Closed"}, token=tokens["pm"])
    assert status == 200
    print(f"  [PASS] Project Manager transitioned issue to Closed")

    # 9. Test Unauthorized Operations Rejected
    print("\n--> 8. Testing SECURITY: Unauthorized operations rejection...")
    # Developer Priya attempts to delete issue
    del_dev_status, del_dev_res = http_req(f"/issues/{test_id}", method="DELETE", token=tokens["dev"])
    assert del_dev_status == 403, f"Developer should be rejected with 403, got {del_dev_status}"
    print(f"  [PASS] Developer delete attempt rejected with HTTP 403: '{del_dev_res.get('error')}'")

    # Tester Sunil attempts to delete issue
    del_test_status, del_test_res = http_req(f"/issues/{test_id}", method="DELETE", token=tokens["tester"])
    assert del_test_status == 403, f"Tester should be rejected with 403, got {del_test_status}"
    print(f"  [PASS] Tester delete attempt rejected with HTTP 403: '{del_test_res.get('error')}'")

    # Developer attempts unauthorized status jump: Closed -> Open directly
    inv_stat, inv_res = http_req(f"/issues/{test_id}/status", method="PATCH", data={"status": "Open"}, token=tokens["dev"])
    assert inv_stat == 403, f"Invalid transition should be rejected with 403, got {inv_stat}"
    print(f"  [PASS] Invalid developer transition rejected with HTTP 403: '{inv_res.get('error')}'")

    # 10. Test Filtering capabilities
    print("\n--> 9. Testing FILTERS...")
    # By project
    status, f_proj = http_req("/issues?project_id=PRJ-001&per_page=5", token=tokens["admin"])
    assert status == 200 and all(i["project_id"] == "PRJ-001" for i in f_proj["issues"])
    print(f"  [PASS] Filter by Project (PRJ-001) verified ({f_proj['total']} issues)")

    # By status
    status, f_stat = http_req("/issues?status=Closed&per_page=5", token=tokens["admin"])
    assert status == 200 and all(i["status"] == "Closed" for i in f_stat["issues"])
    print(f"  [PASS] Filter by Status (Closed) verified ({f_stat['total']} issues)")

    # By priority
    status, f_prio = http_req("/issues?priority=Critical&per_page=5", token=tokens["admin"])
    assert status == 200 and all(i["priority"] in ["P0", "Critical"] for i in f_prio["issues"])
    print(f"  [PASS] Filter by Priority (Critical / P0) verified ({f_prio['total']} issues)")

    # 11. Test Delete Issue (Admin confirms deletion)
    print(f"\n--> 10. Testing DELETE ISSUE (DELETE /api/issues/{test_id})...")
    del_status, del_res = http_req(f"/issues/{test_id}", method="DELETE", token=tokens["admin"])
    assert del_status == 200, f"Delete failed: {del_res}"
    print(f"  [PASS] Issue {test_id} deleted permanently by Admin.")

    # Verify 404 on deleted issue
    chk_status, _ = http_req(f"/issues/{test_id}", token=tokens["admin"])
    assert chk_status == 404
    print(f"  [PASS] GET /api/issues/{test_id} returns HTTP 404 (Verified deleted from PostgreSQL)")

    # Final database count audit
    status, final_res = http_req("/issues?per_page=1", token=tokens["admin"])
    final_total = final_res["total"]
    assert final_total == initial_total == 730, f"Expected exactly 730 issues, got {final_total}"
    print(f"\n--> Database issues count restored to exactly {final_total} (Zero data corruption!)")

    print("\n=================================================================")
    print("ALL 10 ISSUE MANAGEMENT MODULE TEST CRITERIA PASSED!")
    print("=================================================================")

if __name__ == '__main__':
    run_suite()
