def test_dashboard_stats_api(client, admin_headers):
    """Test dashboard stats endpoint performance and total count."""
    res = client.get("/api/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "totals" in data
    assert data["totals"]["total_issues"] >= 730
