"""Unit tests for Stage 4 Performance Inspector (GET /v1/metrics)."""

import uuid
import pytest
from app.db.database import SessionLocal, init_db
from app.db.repositories import RunRepository


def test_metrics_endpoint(client):
    """Verify GET /v1/metrics returns aggregated metrics payload."""
    # Ensure tables initialized
    init_db()

    # Seed mock run record
    db = SessionLocal()
    repo = RunRepository(db)
    repo.create_run(
        request_id=f"test_run_req_{uuid.uuid4()}",
        task_type="code",
        model="gpt-4o-mini",
        prompt_version="v1",
        input_tokens=100,
        output_tokens=20,
        latency_ms=150.0,
        compression_ratio=0.8,
        evaluation_score=0.9,
    )
    db.close()

    response = client.get("/v1/metrics")
    assert response.status_code == 200
    data = response.json()

    assert data["total_requests"] >= 1
    assert data["avg_latency_ms"] > 0
    assert "p95_latency_ms" in data
    assert "avg_input_tokens" in data
    assert "avg_output_tokens" in data
    assert "pass_rate" in data
