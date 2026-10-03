"""LLM Client wrapping official OpenAI SDK with timing, token tracking, and clean error handling."""

import logging
import os
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

import openai
from openai import OpenAI

from app.core.config import settings
from app.models.responses import UsageMetadata

logger = logging.getLogger(__name__)


class LLMClientError(Exception):
    """Custom exception raised when LLM generation fails."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        original_error: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.original_error = original_error


class LLMGenerationResult(BaseModel):
    """Normalized output from LLM generation call."""

    content: str = Field(..., description="Generated text content")
    usage: UsageMetadata = Field(default_factory=UsageMetadata, description="Token usage details")
    latency_ms: float = Field(..., description="Request duration in milliseconds")
    model: str = Field(..., description="Model ID used for generation")
    finish_reason: Optional[str] = Field(default=None, description="Completion finish reason")


class LLMClient:
    """Centralized LLM client wrapping OpenAI SDK with multi-provider and Groq support."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        # Priority: explicit api_key -> GROQ_API_KEY -> OPENAI_API_KEY
        key = (
            api_key
            or settings.GROQ_API_KEY
            or os.getenv("GROQ_API_KEY")
            or settings.OPENAI_API_KEY
            or os.getenv("OPENAI_API_KEY")
        )
        url = base_url or settings.OPENAI_BASE_URL or os.getenv("OPENAI_BASE_URL") or None
        
        # Auto-configure Groq base URL if Groq key is detected and no custom URL is provided
        if not url and (
            settings.GROQ_API_KEY
            or os.getenv("GROQ_API_KEY")
            or (key and key.startswith("gsk_"))
        ):
            url = settings.GROQ_BASE_URL or "https://api.groq.com/openai/v1"

        if not key or key == "mock-key-for-development":
            logger.warning("API key is unset or using default mock value.")
        self.client = OpenAI(api_key=key, base_url=url) if key else None

    def generate(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_output_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMGenerationResult:
        """Generates completion using Chat Completions API (OpenAI / Groq / OpenRouter).

        Args:
            messages: List of message dictionaries with 'role' and 'content'.
            model: Target model identifier.
            temperature: Sampling temperature.
            max_output_tokens: Maximum tokens allowed in response.

        Returns:
            LLMGenerationResult containing content, usage metadata, and latency.

        Raises:
            LLMClientError: Clean wrapper for API connection, rate limit, or authentication errors.
        """
        if not self.client:
            raise LLMClientError("LLM API key is missing or unconfigured.", status_code=500)

        # Fallback model resolution
        target_model = model or settings.DEFAULT_MODEL
        if not target_model:
            base_url_str = str(self.client.base_url) if hasattr(self.client, "base_url") else ""
            if "groq.com" in base_url_str or settings.GROQ_API_KEY:
                target_model = "openai/gpt-oss-120b"
            else:
                target_model = "gpt-4o-mini"

        params: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_output_tokens is not None:
            params["max_tokens"] = max_output_tokens

        params.update(kwargs)

        start_time = time.perf_counter()
        try:
            response = self.client.chat.completions.create(**params)
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0

            choice = response.choices[0]
            content = choice.message.content or ""
            finish_reason = choice.finish_reason

            usage_info = response.usage
            input_tokens = usage_info.prompt_tokens if usage_info else 0
            output_tokens = usage_info.completion_tokens if usage_info else 0
            total_tokens = usage_info.total_tokens if usage_info else (input_tokens + output_tokens)

            usage = UsageMetadata(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
            )

            logger.info(
                "LLM generation successful",
                extra={
                    "model": model,
                    "latency_ms": round(elapsed_ms, 2),
                    "status": "success",
                },
            )

            return LLMGenerationResult(
                content=content,
                usage=usage,
                latency_ms=round(elapsed_ms, 2),
                model=response.model or model,
                finish_reason=finish_reason,
            )

        except openai.AuthenticationError as e:
            logger.error(f"OpenAI Authentication Failed: {e}")
            raise LLMClientError(
                "Authentication with OpenAI API failed. Please check API key.",
                status_code=401,
                original_error=e,
            )
        except openai.RateLimitError as e:
            logger.error(f"OpenAI Rate Limit Exceeded: {e}")
            raise LLMClientError(
                "OpenAI API rate limit exceeded.",
                status_code=429,
                original_error=e,
            )
        except openai.APIConnectionError as e:
            logger.error(f"OpenAI Network Error: {e}")
            raise LLMClientError(
                "Failed to connect to OpenAI service.",
                status_code=503,
                original_error=e,
            )
        except openai.OpenAIError as e:
            logger.error(f"OpenAI API Error: {e}")
            raise LLMClientError(f"OpenAI API error: {str(e)}", original_error=e)
        except Exception as e:
            logger.error(f"Unexpected Error during LLM generation: {e}")
            raise LLMClientError(f"Unexpected error during generation: {str(e)}", original_error=e)
