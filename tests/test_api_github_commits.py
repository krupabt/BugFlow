def test_github_commits_endpoint(client):
    """Test retrieving commit list from backend endpoint."""
    res = client.get("/api/github/commits")
    assert res.status_code == 200
    data = res.get_json()
    assert "commits" in data
    assert isinstance(data["commits"], list)

def test_issue_github_activity_endpoint(client):
    """Test retrieving GitHub activity for an issue."""
    res = client.get("/api/github/issues/BUG-00086/activity")
    assert res.status_code == 200
    data = res.get_json()
    assert data["issue_id"] == "BUG-00086"
    assert "status" in data
