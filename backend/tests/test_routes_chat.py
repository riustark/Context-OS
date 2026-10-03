"""Unit tests for POST /v1/chat API route."""

from unittest.mock import MagicMock, patch
import pytest
from app.core.llm_client import LLMGenerationResult
from app.models.responses import UsageMetadata


@patch("app.api.routes_chat.LLMClient")
def test_chat_endpoint_successful(mock_llm_client_cls, client):
    """Verify POST /v1/chat returns normalized response with metrics, policy, and usage."""
    mock_instance = MagicMock()
    mock_instance.generate.return_value = LLMGenerationResult(
        content="The bug is caused by an off-by-one indexing error.",
        usage=UsageMetadata(input_tokens=120, output_tokens=30, total_tokens=150),
        latency_ms=250.0,
        model="gpt-4o-mini",
        finish_reason="stop",
    )
    mock_llm_client_cls.return_value = mock_instance

    payload = {
        "message": "Explain this code and identify the likely bug.",
        "conversation": [
            {"role": "user", "content": "Here is original problem..."},
            {"role": "assistant", "content": "Previous response..."}
        ],
        "context": [
            {"type": "document", "content": "Relevant engineering documentation...", "importance": 0.9}
        ],
        "task_type": "code"
    }

    response = client.post("/v1/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "request_id" in data
    assert data["answer"] == "The bug is caused by an off-by-one indexing error."
    assert data["usage"]["input_tokens"] == 120
    assert data["usage"]["output_tokens"] == 30
    assert data["metrics"]["latency_ms"] == 250.0
    assert data["policy"]["task_type"] == "code"
    assert data["policy"]["model"] == "gpt-4o-mini"
    assert data["policy"]["temperature"] == 0.1
