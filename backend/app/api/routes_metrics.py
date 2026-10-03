"""Metrics API routes."""

from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.repositories import RunRepository

router = APIRouter()


@router.get("/metrics", response_model=Dict[str, Any])
async def metrics_endpoint(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve operational telemetry & performance metrics summary."""
    repo = RunRepository(db)
    return repo.get_metrics_summary()


@router.get("/runs")
async def get_runs_endpoint(limit: int = 50, db: Session = Depends(get_db)):
    """Retrieve recent LLM execution run records."""
    repo = RunRepository(db)
    runs = repo.get_recent_runs(limit=limit)
    return [
        {
            "id": r.id,
            "request_id": r.request_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else "",
            "task_type": r.task_type,
            "model": r.model,
            "prompt_version": r.prompt_version,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "latency_ms": r.latency_ms,
            "compression_ratio": r.compression_ratio,
            "evaluation_score": r.evaluation_score,
            "status": r.status,
            "error_type": r.error_type,
        }
        for r in runs
    ]

