"""Unit tests for Stage 4 Performance Inspector (Evaluator & POST /v1/evaluate)."""

import pytest
from app.core.evaluator import BenchmarkSummary, Evaluator


def test_evaluator_load_benchmark_cases():
    """Verify loading benchmark cases from scripts/eval_cases.json."""
    cases = Evaluator.load_benchmark_cases()
    assert isinstance(cases, list)
    assert len(cases) >= 5


def test_evaluator_quality_score():
    """Verify quality score calculation logic."""
    case = {"expected_keyword": "Python"}
    assert Evaluator.evaluate_quality(case, "Python is a programming language") >= 0.7
    assert Evaluator.evaluate_quality(case, "Java is a programming language") < 0.7
    assert Evaluator.evaluate_quality(case, "") == 0.0


def test_evaluator_run_benchmark():
    """Verify benchmark run produces aggregated metrics summary."""
    summary = Evaluator.run_benchmark()
    assert isinstance(summary, BenchmarkSummary)
    assert summary.total_cases > 0
    assert summary.pass_rate >= 0.0
    assert summary.avg_latency_ms >= 0.0


def test_evaluate_endpoint(client):
    """Verify POST /v1/evaluate returns benchmark summary."""
    response = client.post("/v1/evaluate")
    assert response.status_code == 200
    data = response.json()
    assert "total_cases" in data
    assert "pass_rate" in data
    assert "avg_latency_ms" in data
