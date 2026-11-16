def test_login_api_success(client):
    """Test successful authentication with valid credentials for Admin."""
    res = client.post("/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "BugFlow@2026"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "access_token" in data
    assert data["user"]["role"] in ["ADMIN", "ADMINISTRATOR"]

def test_login_api_invalid_password(client):
    """Test authentication rejection with invalid credentials."""
    res = client.post("/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "WrongPassword!999"
    })
    assert res.status_code in [401, 400]
