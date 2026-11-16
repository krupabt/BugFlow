def test_github_status_metadata(client):
    """Test repository metadata and default branch."""
    res = client.get("/api/github/status")
    assert res.status_code == 200
    data = res.get_json()
    assert "default_branch" in data
    assert data["default_branch"] in ["main", "master"]
