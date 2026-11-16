def test_issues_list_retrieval(client, admin_headers):
    """Test retrieving issues list with pagination."""
    res = client.get("/api/issues?page=1&per_page=10", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "issues" in data
    assert len(data["issues"]) > 0

def test_issue_details_retrieval(client, admin_headers):
    """Test retrieving details of an existing issue."""
    res = client.get("/api/issues/BUG-00086", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    issue = data.get("issue") or data
    assert issue["id"] == "BUG-00086"
