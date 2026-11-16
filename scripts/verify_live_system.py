import requests
import json
import os

BASE_URL = "http://127.0.0.1:5000"

def test_live_system():
    print("=" * 70)
    print("TESTING LIVE SERVER AT http://127.0.0.1:5000 VIA REQUESTS")
    print("=" * 70)

    # 1. Health check
    h = requests.get(f"{BASE_URL}/api/health")
    assert h.status_code == 200, f"Health check failed: {h.text}"
    print(f"[PASS] 1. Health Check: {h.json()}")

    # 2. Login
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "BugFlow@2026"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"[PASS] 2. Login Successful: JWT token acquired")

    # 3. GET /api/issues
    issues_res = requests.get(f"{BASE_URL}/api/issues?page=1&per_page=5", headers=headers)
    assert issues_res.status_code == 200, f"Get issues failed: {issues_res.text}"
    data = issues_res.json()
    assert data["success"] is True
    print(f"[PASS] 3. GET /api/issues: Total = {data['total']}, Summary = {data['summary']}")

    # 4. POST /api/issues (Create new issue)
    create_res = requests.post(f"{BASE_URL}/api/issues", headers=headers, json={
        "title": "Verification Issue via Requests",
        "description": "Integration testing live server routes",
        "project_id": "PRJ-001",
        "issue_type": "Bug",
        "severity": "Medium",
        "priority": "P2",
        "affected_module": "Dashboard",
        "environment": "Development"
    })
    assert create_res.status_code == 201, f"Create issue failed: {create_res.text}"
    created_id = create_res.json()["data"]["issue_id"]
    print(f"[PASS] 4. POST /api/issues: Created issue '{created_id}'")

    # 5. GET /api/issues/<id>
    single_res = requests.get(f"{BASE_URL}/api/issues/{created_id}", headers=headers)
    assert single_res.status_code == 200, f"Get issue failed: {single_res.text}"
    assert single_res.json()["id"] == created_id
    print(f"[PASS] 5. GET /api/issues/{created_id}: Title = '{single_res.json()['title']}'")

    # 6. PUT /api/issues/<id>
    update_res = requests.put(f"{BASE_URL}/api/issues/{created_id}", headers=headers, json={
        "title": "Verification Issue via Requests (Updated)",
        "severity": "High"
    })
    assert update_res.status_code == 200, f"Update issue failed: {update_res.text}"
    assert update_res.json()["success"] is True
    print(f"[PASS] 6. PUT /api/issues/{created_id}: Updated successfully")

    # 7. PATCH /api/issues/<id>/assign
    assign_res = requests.patch(f"{BASE_URL}/api/issues/{created_id}/assign", headers=headers, json={
        "assigned_to": "USR-005"
    })
    assert assign_res.status_code == 200, f"Assign issue failed: {assign_res.text}"
    assert assign_res.json()["data"]["assigned_to"] == "USR-005"
    print(f"[PASS] 7. PATCH /api/issues/{created_id}/assign: Assigned to Priya Sharma")

    # 8. PATCH /api/issues/<id>/status
    status_res = requests.patch(f"{BASE_URL}/api/issues/{created_id}/status", headers=headers, json={
        "status": "In Progress",
        "comment": "Status moved to In Progress"
    })
    assert status_res.status_code == 200, f"Status update failed: {status_res.text}"
    assert status_res.json()["data"]["new_status"] == "In Progress"
    print(f"[PASS] 8. PATCH /api/issues/{created_id}/status: Status updated to In Progress")

    # 9. GET /api/projects/PRJ-001/issues
    proj_res = requests.get(f"{BASE_URL}/api/projects/PRJ-001/issues?page=1&per_page=5", headers=headers)
    assert proj_res.status_code == 200, f"Project issues failed: {proj_res.text}"
    assert proj_res.json()["project_id"] == "PRJ-001"
    print(f"[PASS] 9. GET /api/projects/PRJ-001/issues: Project issues total = {proj_res.json()['total']}")

    # 10. GET /api/analytics/projects/PRJ-001
    analytics_res = requests.get(f"{BASE_URL}/api/analytics/projects/PRJ-001", headers=headers)
    assert analytics_res.status_code == 200, f"Analytics failed: {analytics_res.text}"
    a_data = analytics_res.json()["data"]
    assert "summary" in a_data
    assert "status_distribution" in a_data
    assert "defect_trend" in a_data
    assert "severity_distribution" in a_data
    assert "quality_metrics" in a_data
    assert "quality_insights" in a_data
    print(f"[PASS] 10. GET /api/analytics/projects/PRJ-001: Insight = '{a_data['quality_insights']['headline']}' (Score: {a_data['quality_insights']['score']})")

    # 11. DELETE /api/issues/<id>
    del_res = requests.delete(f"{BASE_URL}/api/issues/{created_id}", headers=headers)
    assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
    assert del_res.json()["success"] is True
    print(f"[PASS] 11. DELETE /api/issues/{created_id}: Deleted successfully")

    # 12. Boundary: 404 for deleted issue
    after_del = requests.get(f"{BASE_URL}/api/issues/{created_id}", headers=headers)
    assert after_del.status_code == 404
    print(f"[PASS] 12. Verification: Deleted issue returns 404 as expected")

    print("=" * 70)
    print("ALL LIVE REQUEST TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_live_system()
