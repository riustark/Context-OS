"""Response schemas for ContextOS API endpoints."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", json_schema_extra={"example": "ok"})
    environment: str = Field(default="development")
    version: str = Field(default="0.1.0")


class UsageMetadata(BaseModel):
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class MetricsData(BaseModel):
    latency_ms: float = Field(default=0.0, ge=0.0)
    context_compression_ratio: float = Field(default=1.0, ge=0.0, le=1.0)


class PolicyData(BaseModel):
    task_type: str
    model: str
    temperature: float
    max_output_tokens: Optional[int] = None


class ChatResponse(BaseModel):
    request_id: str = Field(..., description="Unique UUID for tracing this execution run")
    answer: str = Field(..., description="LLM generated answer")
    usage: UsageMetadata = Field(..., description="Token usage details")
    metrics: MetricsData = Field(..., description="Operational & latency metrics")
    policy: PolicyData = Field(..., description="Applied inference policy configuration")
