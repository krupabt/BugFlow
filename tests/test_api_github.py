def test_github_connection_status(client):
    """Test retrieving GitHub connection status and truthful states."""
    res = client.get("/api/github/status")
    assert res.status_code == 200
    data = res.get_json()
    assert "status" in data
    assert data["status"] in ["Connected", "Not Connected", "Authentication Failed"]
    assert "repository_name" in data

def test_github_connect_unauthorized_user(client):
    """Test that unauthorized user cannot connect repository."""
    res = client.post("/api/github/connect", json={"token": "fake_token"})
    assert res.status_code == 401 # Missing JWT
