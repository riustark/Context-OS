"""Unit tests for FastAPI health check endpoint."""

def test_health_check_returns_200(client):
    """Verify GET /health returns 200 OK and expected status response."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "version" in data
