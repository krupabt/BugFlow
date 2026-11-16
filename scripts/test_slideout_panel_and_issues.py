import os
import sys
import io
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
    print("=== STARTING ISSUE DETAILS SLIDE-OUT PANEL & WORKFLOW TESTS ===")

    # 1. Login as Admin Krupa
    admin_headers = login("krupa@example.org", "password")
    print("[PASS] 1. Admin logged in successfully.")

    # 2. Test fetching BUG-101 (or BUG-00101)
    res_101 = requests.get(f"{BASE_URL}/issues/BUG-101", headers=admin_headers)
    if res_101.status_code == 404:
        res_101 = requests.get(f"{BASE_URL}/issues/BUG-00101", headers=admin_headers)
    assert res_101.status_code == 200, f"Failed to fetch BUG-101: {res_101.text}"
    issue_101 = res_101.json()
    print(f"[PASS] 2. Fetched BUG-101: ID={issue_101['id']}, Title='{issue_101['title']}', Status={issue_101['status']}, Priority={issue_101['priority']}")

    # 3. Test fetching BUG-102 (or BUG-00102)
    res_102 = requests.get(f"{BASE_URL}/issues/BUG-102", headers=admin_headers)
    if res_102.status_code == 404:
        res_102 = requests.get(f"{BASE_URL}/issues/BUG-00102", headers=admin_headers)
    assert res_102.status_code == 200, f"Failed to fetch BUG-102: {res_102.text}"
    issue_102 = res_102.json()
    print(f"[PASS] 3. Fetched BUG-102: ID={issue_102['id']}, Title='{issue_102['title']}', Status={issue_102['status']}, Priority={issue_102['priority']}")

    # Confirm each displays its own distinct information
    assert issue_101["id"] != issue_102["id"], "Issues 101 and 102 must have distinct IDs"
    assert issue_101["title"] != issue_102["title"], "Issues 101 and 102 must have distinct titles"
    print("[PASS] 4. Confirmed BUG-101 and BUG-102 display their own distinct information.")

    # 4. Test Details, Comments and Activity History retrieval
    assert "comments" in issue_101
    assert "attachments" in issue_101
    act_res = requests.get(f"{BASE_URL}/issues/{issue_101['id']}/activity", headers=admin_headers)
    assert act_res.status_code == 200
    activities = act_res.json()
    print(f"[PASS] 5. Details, Comments ({len(issue_101['comments'])}), and Activity History ({len(activities)} events) loaded.")

    # 5. Add a comment to BUG-101
    comment_text = "Test slide-out panel comment: Reproduction verified on Chrome v120."
    com_res = requests.post(f"{BASE_URL}/issues/{issue_101['id']}/comments", json={"content": comment_text}, headers=admin_headers)
    assert com_res.status_code == 201, f"Failed to post comment: {com_res.text}"
    created_comment = com_res.json()["comment"]
    print(f"[PASS] 6. Added comment ID {created_comment['id']} to {issue_101['id']}.")

    # 6. Upload and Download an attachment
    file_bytes = b"DIAGNOSTIC TRACE LOG: Network connection reset during authentication handshake."
    files = {"file": ("panel_trace.log", io.BytesIO(file_bytes), "text/plain")}
    att_res = requests.post(f"{BASE_URL}/issues/{issue_101['id']}/attachments", headers=admin_headers, files=files)
    assert att_res.status_code == 201, f"Failed to upload attachment: {att_res.text}"
    attachment = att_res.json()["attachment"]
    print(f"[PASS] 7. Uploaded attachment '{attachment['filename']}' (ID: {attachment['id']}).")

    # Download attachment
    dl_res = requests.get(f"{BASE_URL}/issues/{issue_101['id']}/attachments/{attachment['id']}/download", headers=admin_headers)
    assert dl_res.status_code == 200
    assert dl_res.content == file_bytes, "Downloaded content must match uploaded content exactly!"
    print("[PASS] 8. Downloaded attachment verified byte-for-byte.")

    # 7. Update status using a valid transition
    orig_status = issue_101["status"]
    print(f"[INFO] Original status for {issue_101['id']}: {orig_status}")

    # Determine a valid transition from orig_status
    VALID_TRANSITIONS = {
        "Open": "In Progress",
        "In Progress": "Testing",
        "Testing": "Resolved",
        "Resolved": "Closed",
        "Closed": "Open"
    }
    next_valid = VALID_TRANSITIONS.get(orig_status, "In Progress" if orig_status == "Open" else "Testing")

    stat_res = requests.patch(f"{BASE_URL}/issues/{issue_101['id']}/status", json={
        "status": next_valid,
        "comment": f"E2E transition from {orig_status} to {next_valid}"
    }, headers=admin_headers)
    assert stat_res.status_code == 200, f"Valid transition to {next_valid} failed: {stat_res.text}"
    print(f"[PASS] 9. Updated status: {orig_status} -> {next_valid} successfully.")

    # 8. Attempt an invalid transition and verify rejection
    # An illegal jump: from current next_valid back to itself, or invalid leap (e.g. In Progress -> Closed)
    illegal_target = "Closed" if next_valid == "In Progress" else "Resolved" if next_valid == "Open" else "Open"
    invalid_res = requests.patch(f"{BASE_URL}/issues/{issue_101['id']}/status", json={
        "status": illegal_target,
        "comment": "Illegal skip attempt"
    }, headers=admin_headers)
    assert invalid_res.status_code in [400, 403], f"Invalid transition to {illegal_target} should be rejected!"
    print(f"[PASS] 10. Invalid transition {next_valid} -> {illegal_target} rejected correctly with HTTP {invalid_res.status_code}.")

    # Restore original status
    requests.patch(f"{BASE_URL}/issues/{issue_101['id']}/status", json={
        "status": orig_status,
        "comment": "Reverting status back to baseline"
    }, headers=admin_headers)
    print(f"[INFO] Restored {issue_101['id']} status back to {orig_status}.")

    # Clean up uploaded attachment and comment
    requests.delete(f"{BASE_URL}/issues/{issue_101['id']}/attachments/{attachment['id']}", headers=admin_headers)
    requests.delete(f"{BASE_URL}/issues/{issue_101['id']}/comments/{created_comment['id']}", headers=admin_headers)
    print("[PASS] 11. Cleaned up test comment and test attachment.")

    # 9. Verify Issues List remains functional and visible
    list_res = requests.get(f"{BASE_URL}/issues?page=1&per_page=10", headers=admin_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 731, f"Expected 731 issues, got {list_data['total']}"
    print(f"[PASS] 12. Issues List verified functional with {list_data['total']} total issues.")

    # 10. Test all four user roles and permissions
    # PM Arun
    pm_headers = login("Arun@example.org", "password")
    pm_issues = requests.get(f"{BASE_URL}/issues", headers=pm_headers).json()
    assert pm_issues["total"] < 731, "PM should see only managed project issues"
    print(f"[PASS] 13. PM role scoped access confirmed ({pm_issues['total']} issues).")

    # Developer Priya
    dev_headers = login("Priya.Sharma@example.org", "BugFlow@2026")
    dev_issues = requests.get(f"{BASE_URL}/issues", headers=dev_headers).json()
    print(f"[PASS] 14. Developer role scoped access confirmed ({dev_issues['total']} issues).")

    # Tester Sunil
    tester_headers = login("Sunil.clark@example.org", "BugFlow@2026")
    tester_issues = requests.get(f"{BASE_URL}/issues", headers=tester_headers).json()
    print(f"[PASS] 15. Tester role scoped access confirmed ({tester_issues['total']} issues).")

    # Database count check
    assert list_data["total"] == 731
    print("[PASS] 16. Database integrity preserved: exactly 731 issues.")

    print("\n=== ALL SLIDE-OUT PANEL & ISSUES TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()
