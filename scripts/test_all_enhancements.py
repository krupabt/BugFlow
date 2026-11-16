import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app
from extensions import db
from models.user import User
from models.issue import Issue

def run_tests():
    client = app.test_client()
    print("=" * 70)
    print("STARTING COMPLETE BUGFLOW ENHANCEMENT SUITE TESTS")
    print("=" * 70)

    # 1. AUTHENTICATION LOGIN
    login_res = client.post('/api/auth/login', json={
        'email': 'krupa@example.org',
        'password': 'BugFlow@2026'
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.data}"
    login_data = json.loads(login_res.data)
    token = login_data['access_token']
    auth_headers = {'Authorization': f'Bearer {token}'}
    print("[PASS] 1. Auth Login: successfully obtained JWT token for Krupa (Admin)")

    # 2. GET ALL ISSUES
    issues_res = client.get('/api/issues?page=1&per_page=10', headers=auth_headers)
    assert issues_res.status_code == 200, f"Get issues failed: {issues_res.data}"
    issues_data = json.loads(issues_res.data)
    assert 'issues' in issues_data and 'total' in issues_data
    assert 'summary' in issues_data, "Summary stats missing in GET /api/issues"
    print(f"[PASS] 2. GET /api/issues: Total: {issues_data['total']}, Summary: {issues_data['summary']}")

    # 3. GET SINGLE ISSUE BY ID
    single_res = client.get('/api/issues/BUG-00086', headers=auth_headers)
    assert single_res.status_code == 200, f"Get single issue failed: {single_res.data}"
    single_data = json.loads(single_res.data)
    assert single_data.get('id') == 'BUG-00086' or single_data.get('data', {}).get('id') == 'BUG-00086'
    print(f"[PASS] 3. GET /api/issues/BUG-00086: Title = '{single_data.get('title')}'")

    # 4. CREATE NEW ISSUE (POST /api/issues)
    create_payload = {
        "title": "Automated Test Defect - Payment Processing",
        "description": "Integration test created during enhancement validation",
        "project_id": "PRJ-001",
        "issue_type": "Bug",
        "severity": "High",
        "priority": "P2",
        "affected_module": "Payment",
        "environment": "Testing"
    }
    create_res = client.post('/api/issues', json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201, f"Create issue failed: {create_res.data}"
    create_data = json.loads(create_res.data)
    created_id = create_data.get('data', {}).get('issue_id') or create_data.get('issue', {}).get('id')
    assert created_id is not None, "Created issue ID missing"
    print(f"[PASS] 4. POST /api/issues: Generated issue ID '{created_id}' with status 201")

    # 5. UPDATE ISSUE DETAILS (PUT /api/issues/<id>)
    update_res = client.put(f'/api/issues/{created_id}', json={
        "title": "Automated Test Defect - Payment Processing (Updated)",
        "description": "Updated description content for test validation"
    }, headers=auth_headers)
    assert update_res.status_code == 200, f"Update issue failed: {update_res.data}"
    update_data = json.loads(update_res.data)
    assert update_data.get('success') is True
    print(f"[PASS] 5. PUT /api/issues/{created_id}: successfully updated issue details")

    # 6. ASSIGN ISSUE TO DEVELOPER (PATCH /api/issues/<id>/assign)
    assign_res = client.patch(f'/api/issues/{created_id}/assign', json={
        "assigned_to": "USR-005"
    }, headers=auth_headers)
    assert assign_res.status_code == 200, f"Assign issue failed: {assign_res.data}"
    assign_data = json.loads(assign_res.data)
    assert assign_data.get('success') is True
    print(f"[PASS] 6. PATCH /api/issues/{created_id}/assign: assigned to Priya Sharma (USR-005)")

    # 7. UPDATE ISSUE STATUS (PATCH /api/issues/<id>/status)
    # Open -> In Progress
    status_res = client.patch(f'/api/issues/{created_id}/status', json={
        "status": "In Progress",
        "comment": "Developer picked up issue for active debugging"
    }, headers=auth_headers)
    assert status_res.status_code == 200, f"Status update failed: {status_res.data}"
    status_data = json.loads(status_res.data)
    assert status_data.get('success') is True
    print(f"[PASS] 7. PATCH /api/issues/{created_id}/status: moved from Open to In Progress")

    # 8. GET PROJECT-WISE ISSUES (GET /api/projects/PRJ-001/issues)
    proj_issues_res = client.get('/api/projects/PRJ-001/issues?page=1&per_page=10', headers=auth_headers)
    assert proj_issues_res.status_code == 200, f"Project issues failed: {proj_issues_res.data}"
    proj_issues_data = json.loads(proj_issues_res.data)
    assert proj_issues_data.get('success') is True
    assert proj_issues_data.get('total') > 0
    print(f"[PASS] 8. GET /api/projects/PRJ-001/issues: Retrieved {len(proj_issues_data['issues'])} issues out of {proj_issues_data['total']}")

    # 9. GET PROJECT ANALYTICS (GET /api/analytics/projects/PRJ-001)
    analytics_res = client.get('/api/analytics/projects/PRJ-001', headers=auth_headers)
    assert analytics_res.status_code == 200, f"Project analytics failed: {analytics_res.data}"
    analytics_data = json.loads(analytics_res.data)
    assert analytics_data.get('success') is True
    data_payload = analytics_data['data']
    assert 'summary' in data_payload
    assert 'status_distribution' in data_payload
    assert 'defect_trend' in data_payload
    assert 'severity_distribution' in data_payload
    assert 'quality_metrics' in data_payload
    assert 'quality_insights' in data_payload
    print(f"[PASS] 9. GET /api/analytics/projects/PRJ-001: Success!")
    print(f"       Summary: {data_payload['summary']}")
    print(f"       Health Insight: {data_payload['quality_insights']['headline']} (Score: {data_payload['quality_insights']['score']})")
    print(f"       Defect Density: {data_payload['quality_metrics']['defect_density']['status']} - {data_payload['quality_metrics']['defect_density']['message']}")

    # 10. DELETE ISSUE (DELETE /api/issues/<id>)
    del_res = client.delete(f'/api/issues/{created_id}', headers=auth_headers)
    assert del_res.status_code == 200, f"Delete issue failed: {del_res.data}"
    del_data = json.loads(del_res.data)
    assert del_data.get('success') is True
    print(f"[PASS] 10. DELETE /api/issues/{created_id}: successfully deleted test issue")

    # 11. NEGATIVE TEST: MISSING ISSUE ID (404)
    not_found_res = client.get('/api/issues/BUG-NONEXISTENT-99999', headers=auth_headers)
    assert not_found_res.status_code == 404
    print("[PASS] 11. Negative Test (Missing Issue ID): Returned 404 as expected")

    # 12. NEGATIVE TEST: INVALID PROJECT ID (404)
    inv_proj_res = client.get('/api/projects/PRJ-NONEXISTENT-999/issues', headers=auth_headers)
    assert inv_proj_res.status_code == 404
    print("[PASS] 12. Negative Test (Invalid Project ID): Returned 404 as expected")

    # 13. NEGATIVE TEST: MISSING REQUIRED FIELDS (400)
    missing_fields_res = client.post('/api/issues', json={"title": "Missing other required fields"}, headers=auth_headers)
    assert missing_fields_res.status_code == 400
    print("[PASS] 13. Negative Test (Missing Required Fields): Returned 400 with validation message")

    # 14. NEGATIVE TEST: UNAUTHORIZED REQUEST (401)
    unauth_res = client.get('/api/issues')
    assert unauth_res.status_code == 401
    print("[PASS] 14. Negative Test (Unauthorized Request): Returned 401 without JWT")

    print("=" * 70)
    print("ALL 14 TEST CASES COMPLETED AND PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
