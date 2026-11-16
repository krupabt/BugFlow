import os
import sys
import io

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
from models.issue import Issue
from models.project import Project
from models.user import User
from models.sprint import Sprint
from models.comment import IssueComment
from models.attachment import IssueAttachment
from models.history import IssueStatusHistory

def run_milestone2_verification():
    app = create_app()
    client = app.test_client()

    print("=" * 80)
    print("BUGFLOW – MILESTONE 2 COMPLETE AUTOMATED VERIFICATION SUITE")
    print("=" * 80)

    with app.app_context():
        # Baseline checks
        baseline_issues_count = Issue.query.count()
        baseline_sprints_count = Sprint.query.count()
        print(f"[Baseline] Issues in PostgreSQL: {baseline_issues_count}")
        print(f"[Baseline] Sprints in PostgreSQL: {baseline_sprints_count}")
        assert baseline_issues_count >= 731, f"Expected at least 731 issues, got {baseline_issues_count}"
        assert baseline_sprints_count == 48, f"Expected 48 sprints, got {baseline_sprints_count}"

        # 1. Authenticate All 4 Roles
        print("\n--- 1. Testing Role Authentication ---")
        creds = {
            "admin": ("krupa@example.org", "BugFlow@2026"),
            "pm": ("Arun@example.org", "BugFlow@2026"),
            "dev": ("Priya.Sharma@example.org", "BugFlow@2026"),
            "tester": ("Sunil.clark@example.org", "BugFlow@2026")
        }
        tokens = {}
        for role, (email, pwd) in creds.items():
            res = client.post("/api/auth/login", json={"email": email, "password": pwd})
            assert res.status_code == 200, f"Login failed for {email}: {res.get_json()}"
            tokens[role] = res.get_json()["access_token"]
            print(f"  [PASS] {role.upper()} authenticated successfully.")

        headers_admin = {"Authorization": f"Bearer {tokens['admin']}"}
        headers_pm = {"Authorization": f"Bearer {tokens['pm']}"}
        headers_dev = {"Authorization": f"Bearer {tokens['dev']}"}
        headers_tester = {"Authorization": f"Bearer {tokens['tester']}"}

        # 2. Test Part 1: Issue Classification & Creation
        print("\n--- 2. Testing Issue Classification & Creation (Part 1) ---")
        issue_payload = {
            "project_id": "PRJ-001",
            "title": "M2_TEST_PAYMENT_FAILURE - 3D Secure Verification Handshake Hang",
            "description": "Payment gateway drops webhook during 3D Secure verification loop.",
            "issue_type": "Bug",
            "severity": "Critical",
            "priority": "P1 – Urgent",
            "affected_module": "Payment",
            "environment": "Production",
            "steps_to_reproduce": "1. Go to checkout\n2. Enter credit card\n3. Wait for OTP modal",
            "expected_result": "Webhook returns 200 OK and confirms transaction",
            "actual_result": "Timeout with HTTP 504 Gateway Timeout"
        }
        res_create = client.post("/api/issues", json=issue_payload, headers=headers_tester)
        assert res_create.status_code == 201, f"Create issue failed: {res_create.get_json()}"
        issue_id = res_create.get_json()["issue"]["id"]
        print(f"  [PASS] Created issue {issue_id} with full classification fields.")

        # Verify in DB
        db_issue = db.session.get(Issue, issue_id)
        assert db_issue.affected_module == "Payment"
        assert db_issue.severity == "Critical"
        assert db_issue.priority == "P1"
        assert db_issue.environment == "Production"
        assert db_issue.status == "Open"
        print("  [PASS] Verified in PostgreSQL table `issues`.")

        # 3. Test Part 2 & 3A: Comments System (Add, Edit, Delete)
        print("\n--- 3. Testing Collaboration - Comments (Part 3A) ---")
        # Add comment
        res_c1 = client.post(f"/api/issues/{issue_id}/comments", json={"content": "Initial QA reproduction confirmed."}, headers=headers_tester)
        assert res_c1.status_code == 201
        comment_id = res_c1.get_json()["comment"]["id"]
        print(f"  [PASS] Comment #{comment_id} posted by Tester.")

        # Edit comment
        res_c_edit = client.put(f"/api/issues/{issue_id}/comments/{comment_id}", json={"content": "Updated QA reproduction confirmed on iOS & Android."}, headers=headers_tester)
        assert res_c_edit.status_code == 200
        assert "iOS & Android" in res_c_edit.get_json()["comment"]["content"]
        print("  [PASS] Comment updated successfully by author.")

        # Verify unauthorized edit is blocked
        res_c_unauth = client.put(f"/api/issues/{issue_id}/comments/{comment_id}", json={"content": "Malicious edit"}, headers=headers_dev)
        assert res_c_unauth.status_code == 403
        print("  [PASS] Unauthorized comment edit correctly blocked with 403.")

        # 4. Test Part 3B: Attachments System (Upload, Download, Delete)
        print("\n--- 4. Testing Collaboration - Attachments (Part 3B) ---")
        sample_file_content = b"CRASH_LOG: 2026-11-01 20:45:00 [ERROR] Webhook timeout in checkout handler"
        data = {
            'file': (io.BytesIO(sample_file_content), 'checkout_crash.log')
        }
        res_upload = client.post(
            f"/api/issues/{issue_id}/attachments",
            data=data,
            content_type='multipart/form-data',
            headers=headers_tester
        )
        assert res_upload.status_code == 201, f"Upload failed: {res_upload.get_json()}"
        attachment_data = res_upload.get_json()["attachment"]
        attachment_id = attachment_data["id"]
        print(f"  [PASS] Attachment #{attachment_id} ('checkout_crash.log') uploaded.")

        # Verify in DB
        db_att = db.session.get(IssueAttachment, attachment_id)
        assert db_att is not None
        assert db_att.filename == "checkout_crash.log"
        print("  [PASS] Attachment verified in PostgreSQL table `issue_attachments`.")

        # Download attachment by reporter (Tester)
        res_dl = client.get(f"/api/issues/{issue_id}/attachments/{attachment_id}/download", headers=headers_tester)
        assert res_dl.status_code == 200
        assert res_dl.data == sample_file_content
        print("  [PASS] Attachment downloaded and verified exact binary match.")

        # Delete attachment
        res_del_att = client.delete(f"/api/issues/{issue_id}/attachments/{attachment_id}", headers=headers_tester)
        assert res_del_att.status_code == 200
        print("  [PASS] Attachment deleted by uploader.")

        # 5. Test Part 4: Sprint Management & Backlog
        print("\n--- 5. Testing Sprint Planning & Backlog Management (Part 4) ---")
        # Invalid dates test (end_date < start_date)
        res_sp_invalid = client.post("/api/sprints", json={
            "project_id": "PRJ-001",
            "name": "Invalid Sprint",
            "start_date": "2026-12-10",
            "end_date": "2026-12-01"
        }, headers=headers_pm)
        assert res_sp_invalid.status_code == 400
        print("  [PASS] Invalid sprint date range correctly rejected with 400.")

        # Valid create sprint
        res_sp = client.post("/api/sprints", json={
            "project_id": "PRJ-001",
            "name": "M2 Validation Sprint",
            "goal": "Verify complete milestone 2 deliverables and collaboration features",
            "start_date": "2026-11-01",
            "end_date": "2026-11-15"
        }, headers=headers_pm)
        assert res_sp.status_code == 201, f"Create sprint failed: {res_sp.get_json()}"
        sprint_id = res_sp.get_json()["sprint"]["id"]
        print(f"  [PASS] Sprint {sprint_id} created by Project Manager.")

        # Check sprint backlog
        res_backlog = client.get(f"/api/sprints/{sprint_id}/backlog", headers=headers_pm)
        assert res_backlog.status_code == 200
        backlog_items = res_backlog.get_json()
        assert any(i["id"] == issue_id for i in backlog_items), "Test issue should be in backlog before assignment"
        print(f"  [PASS] Verified {issue_id} is in project backlog ({len(backlog_items)} backlog items).")

        # Add issue to sprint
        res_add_sp = client.post(f"/api/sprints/{sprint_id}/issues", json={"issue_id": issue_id}, headers=headers_pm)
        assert res_add_sp.status_code == 200
        print(f"  [PASS] Issue {issue_id} assigned to sprint {sprint_id}.")

        # Prevent duplicate assignment
        res_dup_sp = client.post(f"/api/sprints/{sprint_id}/issues", json={"issue_id": issue_id}, headers=headers_pm)
        assert res_dup_sp.status_code == 400
        print("  [PASS] Duplicate assignment correctly prevented.")

        # Check sprint details & metrics
        res_sp_detail = client.get(f"/api/sprints/{sprint_id}", headers=headers_dev)
        assert res_sp_detail.status_code == 200
        sp_data = res_sp_detail.get_json()
        assert sp_data["total_issues"] >= 1
        assert any(i["id"] == issue_id for i in sp_data["issues"])
        print(f"  [PASS] Sprint details verified: Total issues = {sp_data['total_issues']}.")

        # 6. Test Part 5: Workflow Automation & Lifecycle
        print("\n--- 6. Testing Workflow Automation & Lifecycle (Part 5) ---")
        # Assign Developer
        res_assign = client.patch(f"/api/issues/{issue_id}/assign", json={"assigned_to": "USR-005"}, headers=headers_pm)
        assert res_assign.status_code == 200
        print(f"  [PASS] Issue assigned to USR-005 (Priya Sharma).")

        # Invalid transition: Open -> Closed (NOT allowed)
        res_invalid_trans = client.patch(f"/api/issues/{issue_id}/status", json={"status": "Closed"}, headers=headers_admin)
        assert res_invalid_trans.status_code == 400
        print("  [PASS] Invalid transition Open -> Closed correctly rejected with 400.")

        # Valid transition: Open -> In Progress (Developer)
        res_trans_1 = client.patch(f"/api/issues/{issue_id}/status", json={"status": "In Progress"}, headers=headers_dev)
        assert res_trans_1.status_code == 200
        assert res_trans_1.get_json()["issue"]["status"] == "In Progress"
        print("  [PASS] Transition Open -> In Progress succeeded.")

        # Valid transition: In Progress -> Testing (Developer)
        res_trans_2 = client.patch(f"/api/issues/{issue_id}/status", json={"status": "Testing"}, headers=headers_dev)
        assert res_trans_2.status_code == 200
        assert res_trans_2.get_json()["issue"]["status"] == "Testing"
        print("  [PASS] Transition In Progress -> Testing succeeded.")

        # Testing failed transition: Testing -> In Progress (Tester)
        res_trans_fail = client.patch(f"/api/issues/{issue_id}/status", json={"status": "In Progress", "comment": "Verification failed: regression on Safari"}, headers=headers_tester)
        assert res_trans_fail.status_code == 200
        assert res_trans_fail.get_json()["issue"]["status"] == "In Progress"
        print("  [PASS] Transition Testing -> In Progress (test failed) succeeded.")

        # Move back to Testing
        client.patch(f"/api/issues/{issue_id}/status", json={"status": "Testing"}, headers=headers_dev)

        # Valid transition: Testing -> Resolved (Tester)
        res_trans_3 = client.patch(f"/api/issues/{issue_id}/status", json={
            "status": "Resolved",
            "resolution_summary": "Fixed webhook handshake timeout by setting keepalive headers.",
            "root_cause": "TCP keepalive missing in reverse proxy configuration."
        }, headers=headers_tester)
        assert res_trans_3.status_code == 200
        assert res_trans_3.get_json()["issue"]["status"] == "Resolved"
        print("  [PASS] Transition Testing -> Resolved succeeded with resolution details.")

        # Valid transition: Resolved -> Closed (Tester)
        res_trans_4 = client.patch(f"/api/issues/{issue_id}/status", json={"status": "Closed"}, headers=headers_tester)
        assert res_trans_4.status_code == 200
        assert res_trans_4.get_json()["issue"]["status"] == "Closed"
        print("  [PASS] Transition Resolved -> Closed succeeded.")

        # Valid Reopening: Closed -> Open (Admin / PM)
        res_reopen = client.patch(f"/api/issues/{issue_id}/status", json={"status": "Open", "comment": "Reopening defect for customer regression"}, headers=headers_admin)
        assert res_reopen.status_code == 200
        assert res_reopen.get_json()["issue"]["status"] == "Open"
        assert res_reopen.get_json()["issue"]["reopen_count"] >= 1
        print("  [PASS] Transition Closed -> Open (Reopened) succeeded. Reopen count recorded.")

        # 7. Test Part 3C: Activity History
        print("\n--- 7. Testing Activity History & Audit Trail (Part 3C) ---")
        res_act = client.get(f"/api/issues/{issue_id}/activity", headers=headers_admin)
        assert res_act.status_code == 200
        activities = res_act.get_json()
        act_types = [a["action_type"] for a in activities]
        print(f"  [PASS] Total recorded activities on issue: {len(activities)}")
        print(f"         Recorded action types: {set(act_types)}")
        assert "CREATED" in act_types
        assert "COMMENT_ADDED" in act_types
        assert "ATTACHMENT_UPLOADED" in act_types
        assert "SPRINT_ASSIGNED" in act_types
        assert "STATUS_CHANGE" in act_types
        print("  [PASS] All expected event types present in activity history!")

        # 8. Test Part 6: Dashboard Statistics & Scoping
        print("\n--- 8. Testing Scoped Dashboard Statistics (Part 6) ---")
        for role_name, token in tokens.items():
            res_stats = client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
            assert res_stats.status_code == 200
            stats_data = res_stats.get_json()
            assert "totals" in stats_data
            assert "status_distribution" in stats_data
            assert "recent_issues" in stats_data
            dist_total = sum(s["count"] for s in stats_data["status_distribution"])
            assert dist_total == stats_data["totals"]["total_issues"], f"Distribution sum {dist_total} != total {stats_data['totals']['total_issues']}"
            print(f"  [PASS] {role_name.upper()} dashboard: Total = {stats_data['totals']['total_issues']}, Distribution matches total.")

        # 9. Clean up test records
        print("\n--- 9. Cleaning up temporary test records ---")
        # Delete attachment file from disk
        if db_att:
            file_on_disk = os.path.join(backend_dir, "uploads", db_att.file_path)
            if os.path.isfile(file_on_disk):
                try:
                    os.remove(file_on_disk)
                except Exception:
                    pass

        # Delete sprint and issue
        db.session.execute(db.text("DELETE FROM issue_attachments WHERE issue_id = :id"), {"id": issue_id})
        db.session.execute(db.text("DELETE FROM issue_comments WHERE issue_id = :id"), {"id": issue_id})
        db.session.execute(db.text("DELETE FROM issue_status_history WHERE issue_id = :id"), {"id": issue_id})
        db.session.execute(db.text("DELETE FROM issues WHERE id = :id"), {"id": issue_id})
        db.session.execute(db.text("DELETE FROM sprints WHERE id = :id"), {"id": sprint_id})
        db.session.commit()
        print("  [PASS] Cleaned up temporary test issue and test sprint.")

        final_issues_count = Issue.query.count()
        final_sprints_count = Sprint.query.count()
        assert final_issues_count == baseline_issues_count, f"Issues count changed! Expected {baseline_issues_count}, got {final_issues_count}"
        assert final_sprints_count == baseline_sprints_count, f"Sprints count changed! Expected {baseline_sprints_count}, got {final_sprints_count}"
        print(f"  [PASS] PostgreSQL database records 100% preserved (Issues: {final_issues_count}, Sprints: {final_sprints_count}).")

    print("\n" + "=" * 80)
    print("ALL MILESTONE 2 AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_milestone2_verification()
