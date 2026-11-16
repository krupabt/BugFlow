def test_detailed_analytics_api(client, admin_headers):
    """Test detailed analytics aggregation endpoint."""
    res = client.get("/api/analytics/detailed", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("success") is True
    assert "data" in data
    assert "issues_by_status" in data["data"]
