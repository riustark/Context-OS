"""Evaluation API routes."""

from fastapi import APIRouter
from app.core.evaluator import BenchmarkSummary, Evaluator

router = APIRouter()


@router.post("/evaluate", response_model=BenchmarkSummary)
async def evaluate_endpoint() -> BenchmarkSummary:
    """Trigger evaluation benchmark run across representative evaluation dataset."""
    return Evaluator.run_benchmark()
