def test_cicd_status_endpoint(client):
    """Test retrieving CI/CD pipeline status."""
    res = client.get("/api/cicd/status")
    assert res.status_code == 200
    data = res.get_json()
    assert "status" in data

def test_cicd_runs_endpoint(client):
    """Test retrieving CI/CD workflow runs."""
    res = client.get("/api/cicd/runs")
    assert res.status_code == 200
    data = res.get_json()
    assert "runs" in data
    assert isinstance(data["runs"], list)

def test_cicd_metrics_endpoint(client):
    """Test retrieving CI/CD metrics."""
    res = client.get("/api/cicd/metrics")
    assert res.status_code == 200
    data = res.get_json()
    assert "success_rate" in data
