import os
import sys
import io
import requests

BASE_URL = "http://127.0.0.1:5000/api"

def main():
    print("=== STARTING END-TO-END VERIFICATION ===")

    # 1. Login as Admin Krupa
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "krupa@example.org",
        "password": "password"
    })
    if login_res.status_code != 200:
        # try BugFlow@2026
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "krupa@example.org",
            "password": "BugFlow@2026"
        })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json().get("access_token") or login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Admin login successful.")

    # 2. Check baseline issues count
    issues_res = requests.get(f"{BASE_URL}/issues?page=1&per_page=1", headers=headers)
    assert issues_res.status_code == 200
    baseline_total = issues_res.json()["total"]
    print(f"[INFO] Baseline total issues: {baseline_total}")

    # 3. Create a test issue
    create_payload = {
        "project_id": "PRJ-001",
        "title": "E2E Test: Attachment & Details Verification",
        "description": "Testing attachment upload, details card layout, comments, and status workflow.",
        "issue_type": "Bug",
        "severity": "High",
        "priority": "P1",
        "affected_module": "Payment",
        "environment": "QA",
        "steps_to_reproduce": "1. Go to payment\n2. Submit payment\n3. Check attachment logs",
        "expected_result": "Payment processes cleanly",
        "actual_result": "Gateway timeout 504"
    }
    create_res = requests.post(f"{BASE_URL}/issues", json=create_payload, headers=headers)
    assert create_res.status_code == 201, f"Create issue failed: {create_res.text}"
    new_issue = create_res.json()["issue"]
    new_issue_id = new_issue["id"]
    print(f"[PASS] 2. Test issue created with ID: {new_issue_id}")

    try:
        # 4. Upload an attachment (TXT file)
        txt_content = b"CRITICAL LOG: Payment gateway connection refused at 10:45:00 UTC"
        files = {
            "file": ("gateway_crash.log", io.BytesIO(txt_content), "text/plain")
        }
        upload_res = requests.post(f"{BASE_URL}/issues/{new_issue_id}/attachments", headers=headers, files=files)
        assert upload_res.status_code == 201, f"Upload TXT failed: {upload_res.text}"
        attachment_1 = upload_res.json()["attachment"]
        print(f"[PASS] 3. Uploaded attachment 1: {attachment_1['filename']} (ID: {attachment_1['id']})")

        # 5. Upload a second attachment (PNG image file)
        # 1x1 PNG bytes
        png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
        files_png = {
            "file": ("crash_screenshot.png", io.BytesIO(png_bytes), "image/png")
        }
        upload_png_res = requests.post(f"{BASE_URL}/issues/{new_issue_id}/attachments", headers=headers, files=files_png)
        assert upload_png_res.status_code == 201, f"Upload PNG failed: {upload_png_res.text}"
        attachment_2 = upload_png_res.json()["attachment"]
        print(f"[PASS] 4. Uploaded attachment 2: {attachment_2['filename']} (ID: {attachment_2['id']})")

        # 6. Retrieve attachments list for the issue
        list_att_res = requests.get(f"{BASE_URL}/issues/{new_issue_id}/attachments", headers=headers)
        assert list_att_res.status_code == 200
        attachments_list = list_att_res.json()
        assert len(attachments_list) == 2, f"Expected 2 attachments, got {len(attachments_list)}"
        print(f"[PASS] 5. Retrieved attachments list: {[a['filename'] for a in attachments_list]}")

        # 7. Download attachment and check content
        dl_res = requests.get(f"{BASE_URL}/issues/{new_issue_id}/attachments/{attachment_1['id']}/download", headers=headers)
        assert dl_res.status_code == 200, f"Download failed: {dl_res.status_code}"
        assert dl_res.content == txt_content, "Downloaded file content did not match uploaded content!"
        print("[PASS] 6. Downloaded attachment content verified byte-for-byte.")

        # 8. Post a comment on the issue
        comment_payload = {"content": "Investigated the crash. Payment API webhook retry failed due to SSL handshake."}
        com_res = requests.post(f"{BASE_URL}/issues/{new_issue_id}/comments", json=comment_payload, headers=headers)
        assert com_res.status_code == 201, f"Post comment failed: {com_res.text}"
        comment_obj = com_res.json()["comment"]
        print(f"[PASS] 7. Added comment (ID: {comment_obj['id']}): {comment_obj['content']}")

        # 9. Edit comment
        edit_com_payload = {"content": "Investigated the crash. SSL handshake resolved with TLS 1.3 cipher update."}
        edit_com_res = requests.put(f"{BASE_URL}/issues/{new_issue_id}/comments/{comment_obj['id']}", json=edit_com_payload, headers=headers)
        assert edit_com_res.status_code == 200, f"Edit comment failed: {edit_com_res.text}"
        assert "TLS 1.3" in edit_com_res.json()["comment"]["content"]
        print("[PASS] 8. Edited comment successfully.")

        # 10. Status workflow transition: Open -> In Progress -> Testing
        trans_res = requests.patch(f"{BASE_URL}/issues/{new_issue_id}/status", json={
            "status": "In Progress",
            "comment": "Developer began investigating"
        }, headers=headers)
        assert trans_res.status_code == 200, f"Transition failed: {trans_res.text}"
        print("[PASS] 9. Transitioned Open -> In Progress.")

        trans_res2 = requests.patch(f"{BASE_URL}/issues/{new_issue_id}/status", json={
            "status": "Testing",
            "comment": "Fix deployed to QA branch"
        }, headers=headers)
        assert trans_res2.status_code == 200, f"Transition failed: {trans_res2.text}"
        print("[PASS] 10. Transitioned In Progress -> Testing.")

        # 11. Fetch issue details and check comprehensive structure
        detail_res = requests.get(f"{BASE_URL}/issues/{new_issue_id}", headers=headers)
        assert detail_res.status_code == 200, f"Fetch detail failed: {detail_res.text}"
        detail_data = detail_res.json()
        assert detail_data["status"] == "Testing"
        assert detail_data["severity"] == "High"
        assert detail_data["priority"] == "P1"
        assert detail_data["affected_module"] == "Payment"
        assert len(detail_data["attachments"]) == 2
        assert len(detail_data["comments"]) == 1
        print(f"[PASS] 11. Verified issue detail fields: status={detail_data['status']}, attachments={len(detail_data['attachments'])}, comments={len(detail_data['comments'])}")

        # 12. Delete one attachment
        del_att_res = requests.delete(f"{BASE_URL}/issues/{new_issue_id}/attachments/{attachment_2['id']}", headers=headers)
        assert del_att_res.status_code == 200
        print("[PASS] 12. Deleted attachment 2 successfully.")

        # Verify only 1 attachment remains
        list_att_res2 = requests.get(f"{BASE_URL}/issues/{new_issue_id}/attachments", headers=headers)
        assert len(list_att_res2.json()) == 1
        print("[PASS] 13. Verified 1 attachment remains in PostgreSQL.")

    finally:
        # Cleanup test issue and any remaining attachments/comments
        print("[INFO] Cleaning up test issue...")
        del_issue_res = requests.delete(f"{BASE_URL}/issues/{new_issue_id}", headers=headers)
        print(f"[INFO] Delete test issue status: {del_issue_res.status_code}")

        # Check total issues count back to baseline
        issues_res_after = requests.get(f"{BASE_URL}/issues?page=1&per_page=1", headers=headers)
        assert issues_res_after.json()["total"] == baseline_total, f"Expected {baseline_total} issues, found {issues_res_after.json()['total']}"
        print(f"[PASS] Database cleanly restored to baseline {baseline_total} issues.")

    print("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()
