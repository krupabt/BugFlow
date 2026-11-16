import os
import sys
import json

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
from models.issue import Issue
from models.project import Project

def run_tests():
    app = create_app()
    client = app.test_client()

    print("=" * 70)
    print("DAY 1 – ISSUE CLASSIFICATION & PRIORITIZATION VERIFICATION SUITE")
    print("=" * 70)

    with app.app_context():
        # Baseline check
        baseline_count = Issue.query.count()
        print(f"[1] Baseline issues count in PostgreSQL: {baseline_count}")
        assert baseline_count >= 731, f"Expected >= 731 issues, found {baseline_count}"

        # 1. Authenticate users
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
            print(f"  [PASS] Logged in {role.upper()} ({email})")

        admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
        tester_headers = {"Authorization": f"Bearer {tokens['tester']}"}
        dev_headers = {"Authorization": f"Bearer {tokens['dev']}"}

        # 2. Test Create Issue with standard Affected Module
        print("\n[2] Creating Issue with standard Affected Module (Payment), Severity Critical, Priority P1, Type Bug...")
        payload1 = {
            "project_id": "PRJ-001",
            "title": "TEST_DAY1_PAYMENT_FAILURE - Gateway timeout during card charge",
            "description": "Simulated payment processing timeout during checkout transaction.",
            "issue_type": "Bug",
            "severity": "Critical",
            "priority": "P1 – Urgent",
            "affected_module": "Payment",
            "environment": "Production",
            "steps_to_reproduce": "1. Add item to cart\n2. Proceed to checkout\n3. Click pay with Visa",
            "expected_result": "Payment succeeds with confirmation token",
            "actual_result": "504 Gateway Timeout returned from processor"
        }
        res1 = client.post("/api/issues", json=payload1, headers=tester_headers)
        assert res1.status_code == 201, f"Failed to create issue: {res1.get_json()}"
        issue1_data = res1.get_json()["issue"]
        issue1_id = issue1_data["id"]
        print(f"  [PASS] Created issue {issue1_id}")
        assert issue1_data["issue_type"] == "Bug"
        assert issue1_data["severity"] == "Critical"
        assert issue1_data["priority"] == "P1"
        assert issue1_data["affected_module"] == "Payment"

        # Verify directly in PostgreSQL
        db_issue1 = db.session.get(Issue, issue1_id)
        assert db_issue1 is not None
        assert db_issue1.affected_module == "Payment"
        assert db_issue1.severity == "Critical"
        assert db_issue1.priority == "P1"
        assert db_issue1.issue_type == "Bug"
        print("  [PASS] Verified in PostgreSQL database table `issues`!")

        # 3. Test Create Issue with Custom Module Name ("Other")
        print("\n[3] Creating Issue with Custom Affected Module ('Microservice Gateway'), Severity Medium, Priority P3, Type Feature Request...")
        payload2 = {
            "project_id": "PRJ-001",
            "title": "TEST_DAY1_CUSTOM_MODULE - Rate limiting headers on microservice gateway",
            "description": "Add X-RateLimit headers to upstream reverse proxy.",
            "issue_type": "Feature Request",
            "severity": "Medium",
            "priority": "P3 – Medium",
            "affected_module": "Microservice Gateway",
            "environment": "Development"
        }
        res2 = client.post("/api/issues", json=payload2, headers=tester_headers)
        assert res2.status_code == 201, f"Failed to create issue 2: {res2.get_json()}"
        issue2_data = res2.get_json()["issue"]
        issue2_id = issue2_data["id"]
        print(f"  [PASS] Created issue {issue2_id}")
        assert issue2_data["issue_type"] == "Feature Request"
        assert issue2_data["severity"] == "Medium"
        assert issue2_data["priority"] == "P3"
        assert issue2_data["affected_module"] == "Microservice Gateway"

        db_issue2 = db.session.get(Issue, issue2_id)
        assert db_issue2.affected_module == "Microservice Gateway"
        print("  [PASS] Verified custom module in PostgreSQL database!")

        # 4. Test Update Issue (Edit severity, priority, affected_module)
        print(f"\n[4] Updating issue {issue1_id} (Severity -> High, Priority -> P2, Module -> Sprint Management)...")
        update_payload = {
            "severity": "High",
            "priority": "P2 – High",
            "affected_module": "Sprint Management",
            "comment": "Triage review: Lowered severity to High and updated module"
        }
        res_update = client.put(f"/api/issues/{issue1_id}", json=update_payload, headers=admin_headers)
        assert res_update.status_code == 200, f"Failed to update issue: {res_update.get_json()}"
        updated_data = res_update.get_json()["issue"]
        assert updated_data["severity"] == "High"
        assert updated_data["priority"] == "P2"
        assert updated_data["affected_module"] == "Sprint Management"

        # Verify update in PostgreSQL
        db.session.expire_all()
        db_issue1_updated = db.session.get(Issue, issue1_id)
        assert db_issue1_updated.severity == "High"
        assert db_issue1_updated.priority == "P2"
        assert db_issue1_updated.affected_module == "Sprint Management"
        print("  [PASS] Verified issue update in PostgreSQL!")

        # 5. Test Filters and Search
        print("\n[5] Testing Filter endpoints...")
        
        # Filter by affected_module
        res_filter_module = client.get("/api/issues?affected_module=Sprint Management", headers=admin_headers)
        assert res_filter_module.status_code == 200
        module_issues = res_filter_module.get_json()["issues"]
        assert any(i["id"] == issue1_id for i in module_issues), "Updated issue not found in Sprint Management filter"
        print(f"  [PASS] Filter by affected_module=Sprint Management returned {len(module_issues)} issues")

        # Filter by severity
        res_filter_sev = client.get("/api/issues?severity=High", headers=admin_headers)
        assert res_filter_sev.status_code == 200
        sev_issues = res_filter_sev.get_json()["issues"]
        assert any(i["id"] == issue1_id for i in sev_issues), "Issue not found in severity=High filter"
        print(f"  [PASS] Filter by severity=High returned {len(sev_issues)} issues")

        # Filter by priority
        res_filter_pri = client.get("/api/issues?priority=P3", headers=admin_headers)
        assert res_filter_pri.status_code == 200
        pri_issues = res_filter_pri.get_json()["issues"]
        assert any(i["id"] == issue2_id for i in pri_issues), "Issue 2 not found in priority=P3 filter"
        print(f"  [PASS] Filter by priority=P3 returned {len(pri_issues)} issues")

        # Filter by issue_type
        res_filter_type = client.get("/api/issues?issue_type=Feature Request", headers=admin_headers)
        assert res_filter_type.status_code == 200
        type_issues = res_filter_type.get_json()["issues"]
        assert any(i["id"] == issue2_id for i in type_issues), "Issue 2 not found in issue_type=Feature Request filter"
        print(f"  [PASS] Filter by issue_type=Feature Request returned {len(type_issues)} issues")

        # Search by custom module keyword
        res_search = client.get("/api/issues?q=Microservice", headers=admin_headers)
        assert res_search.status_code == 200
        search_issues = res_search.get_json()["issues"]
        assert any(i["id"] == issue2_id for i in search_issues), "Search by module keyword failed"
        print(f"  [PASS] Search by keyword 'Microservice' returned {len(search_issues)} issues")

        # 6. Test Technical Debt Issue Type
        print("\n[6] Testing Technical Debt issue type...")
        payload3 = {
            "project_id": "PRJ-001",
            "title": "TEST_DAY1_TECH_DEBT - Refactor legacy session handling",
            "description": "Clean up deprecated session helper functions.",
            "issue_type": "Technical Debt",
            "severity": "Low",
            "priority": "P4 – Low",
            "affected_module": "User Management"
        }
        res3 = client.post("/api/issues", json=payload3, headers=tester_headers)
        assert res3.status_code == 201
        issue3_data = res3.get_json()["issue"]
        issue3_id = issue3_data["id"]
        assert issue3_data["issue_type"] == "Technical Debt"
        assert issue3_data["severity"] == "Low"
        assert issue3_data["priority"] == "P4"
        assert issue3_data["affected_module"] == "User Management"
        print(f"  [PASS] Created Technical Debt issue {issue3_id}")

        # 7. Clean up test records
        print("\n[7] Cleaning up test issues...")
        for test_id in [issue1_id, issue2_id, issue3_id]:
            db.session.execute(db.text("DELETE FROM issue_comments WHERE issue_id = :id"), {"id": test_id})
            db.session.execute(db.text("DELETE FROM issue_status_history WHERE issue_id = :id"), {"id": test_id})
            db.session.execute(db.text("DELETE FROM issues WHERE id = :id"), {"id": test_id})
        db.session.commit()
        print("  [PASS] Cleaned up temporary test issues")

        final_count = Issue.query.count()
        assert final_count == baseline_count, f"Issue count altered! Expected {baseline_count}, got {final_count}"
        print(f"  [PASS] Final PostgreSQL count matches baseline: {final_count} records preserved perfectly.")

    print("\n" + "=" * 70)
    print("ALL DAY 1 ISSUE CLASSIFICATION & PRIORITIZATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
