"""Structured logging and OpenTelemetry instrumentation for ContextOS."""

import logging
import json
import sys
from typing import Any, Dict
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Include custom context fields attached to record if present
        for attr in ("request_id", "latency_ms", "model", "task_type", "status", "error"):
            if hasattr(record, attr):
                log_data[attr] = getattr(record, attr)

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logging(log_level: str = "INFO") -> None:
    """Configure structured JSON logging for stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.handlers = [handler]


_tracer_initialized = False


def setup_telemetry() -> trace.Tracer:
    """Initialize OpenTelemetry tracer provider."""
    global _tracer_initialized
    if not _tracer_initialized:
        provider = TracerProvider()
        trace.set_tracer_provider(provider)
        _tracer_initialized = True
    return trace.get_tracer("contextos")
