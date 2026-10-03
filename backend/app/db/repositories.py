"""Data persistence repositories for LLM runs and performance metrics."""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db.database import LLMRunModel


class RunRepository:
    """Repository for persisting and querying llm_runs records."""

    def __init__(self, db: Session):
        self.db = db

    def create_run(
        self,
        request_id: str,
        task_type: str,
        model: str,
        prompt_version: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float,
        compression_ratio: float,
        evaluation_score: Optional[float] = None,
        status: str = "success",
        error_type: Optional[str] = None,
    ) -> LLMRunModel:
        """Persist a new LLM execution run record."""
        run = LLMRunModel(
            request_id=request_id,
            task_type=task_type,
            model=model,
            prompt_version=prompt_version,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            compression_ratio=compression_ratio,
            evaluation_score=evaluation_score,
            status=status,
            error_type=error_type,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def get_recent_runs(self, limit: int = 50) -> List[LLMRunModel]:
        """Fetch recent LLM run records ordered by timestamp descending."""
        return (
            self.db.query(LLMRunModel)
            .order_by(LLMRunModel.timestamp.desc())
            .limit(limit)
            .all()
        )

    def get_run_by_request_id(self, request_id: str) -> Optional[LLMRunModel]:
        """Fetch run record by request_id."""
        return self.db.query(LLMRunModel).filter(LLMRunModel.request_id == request_id).first()

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Calculate aggregated operational & telemetry metrics across runs."""
        runs = self.db.query(LLMRunModel).all()
        total_requests = len(runs)

        if total_requests == 0:
            return {
                "total_requests": 0,
                "avg_latency_ms": 0.0,
                "p95_latency_ms": 0.0,
                "avg_input_tokens": 0.0,
                "avg_output_tokens": 0.0,
                "avg_compression_ratio": 1.0,
                "pass_rate": 0.0,
            }

        latencies = sorted([r.latency_ms for r in runs])
        input_toks = [r.input_tokens for r in runs]
        output_toks = [r.output_tokens for r in runs]
        ratios = [r.compression_ratio for r in runs]

        scores = [r.evaluation_score for r in runs if r.evaluation_score is not None]
        pass_count = sum(1 for s in scores if s >= 0.7)
        pass_rate = round(pass_count / len(scores), 2) if scores else 0.0

        p95_idx = min(len(latencies) - 1, int(0.95 * len(latencies)))
        p95_latency = float(latencies[p95_idx]) if latencies else 0.0

        return {
            "total_requests": total_requests,
            "avg_latency_ms": round(sum(latencies) / total_requests, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "avg_input_tokens": round(sum(input_toks) / total_requests, 2),
            "avg_output_tokens": round(sum(output_toks) / total_requests, 2),
            "avg_compression_ratio": round(sum(ratios) / total_requests, 2),
            "pass_rate": pass_rate,
        }
