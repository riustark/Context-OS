"""Adaptive Inference Policy Engine (Dispatcher Stage).

Dynamically selects model target, temperature, and token parameters
based on request task type and context metadata.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.requests import TaskType


class InferencePolicy(BaseModel):
    """Configuration selected for LLM generation call."""

    task_type: TaskType = Field(..., description="Task classification tag")
    model: str = Field(default="gpt-4o-mini", description="Selected OpenAI model identifier")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_output_tokens: int = Field(default=1000, gt=0, description="Maximum tokens allowed for completion")

    def to_generation_kwargs(self) -> Dict[str, Any]:
        """Format kwargs supported by target model."""
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
        }


DEFAULT_POLICY_MAP: Dict[TaskType, Dict[str, Any]] = {
    TaskType.FACTUAL: {
        "temperature": 0.1,
        "max_output_tokens": 800,
    },
    TaskType.CODE: {
        "temperature": 0.1,
        "max_output_tokens": 1500,
    },
    TaskType.STRUCTURED_EXTRACTION: {
        "temperature": 0.0,
        "max_output_tokens": 800,
    },
    TaskType.ANALYTICAL: {
        "temperature": 0.3,
        "max_output_tokens": 1200,
    },
    TaskType.CREATIVE: {
        "temperature": 0.7,
        "max_output_tokens": 1000,
    },
}


class InferencePolicyEngine:
    """Rules-based Adaptive Inference Policy Engine."""

    @classmethod
    def select(
        cls,
        task_type: TaskType,
        context_size: int = 0,
        requested_output_size: Optional[int] = None,
        model_override: Optional[str] = None,
    ) -> InferencePolicy:
        """Selects optimal inference policy parameters.

        Args:
            task_type: TaskType enum value (code, factual, etc.).
            context_size: Estimated input context tokens.
            requested_output_size: Optional client-requested output token limit.
            model_override: Optional explicit model selection override.

        Returns:
            InferencePolicy with selected model, temperature, and max_output_tokens.
        """
        defaults = DEFAULT_POLICY_MAP.get(task_type, {"temperature": 0.7, "max_output_tokens": 1000})

        temperature = float(defaults["temperature"])
        max_output = requested_output_size or defaults["max_output_tokens"]

        # Adjust for large context if needed
        if context_size > 8000 and max_output > 2000:
            max_output = 2000

        target_model = model_override or settings.DEFAULT_MODEL
        if not target_model:
            if settings.GROQ_API_KEY or "groq.com" in settings.OPENAI_BASE_URL:
                target_model = "openai/gpt-oss-120b"
            else:
                target_model = "gpt-4o-mini"

        return InferencePolicy(
            task_type=task_type,
            model=target_model,
            temperature=temperature,
            max_output_tokens=max_output,
        )
