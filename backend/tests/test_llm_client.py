"""Unit tests for Phase 2 LLMClient component."""

from unittest.mock import MagicMock, patch
import pytest
import openai

from app.core.llm_client import LLMClient, LLMClientError, LLMGenerationResult


def test_llm_client_initialization_without_key():
    """Verify LLMClient initialization without API key raises LLMClientError on generate."""
    client = LLMClient(api_key="")
    client.client = None  # Ensure unconfigured client
    with pytest.raises(LLMClientError) as exc_info:
        client.generate(messages=[{"role": "user", "content": "Hello"}])
    assert "missing or unconfigured" in str(exc_info.value)


@patch("app.core.llm_client.OpenAI")
def test_llm_client_successful_generation(mock_openai_cls):
    """Verify LLMClient generate returns normalized result on successful OpenAI response."""
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "This is a test response."
    mock_choice.finish_reason = "stop"
    mock_response.choices = [mock_choice]
    mock_response.model = "gpt-4o-mini"
    
    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 15
    mock_usage.completion_tokens = 10
    mock_usage.total_tokens = 25
    mock_response.usage = mock_usage

    mock_client_inst = MagicMock()
    mock_client_inst.chat.completions.create.return_value = mock_response
    mock_openai_cls.return_value = mock_client_inst

    llm = LLMClient(api_key="sk-test-key-12345")
    result = llm.generate(
        messages=[{"role": "user", "content": "Explain python dicts"}],
        model="gpt-4o-mini",
        temperature=0.2,
        max_output_tokens=100,
    )

    assert isinstance(result, LLMGenerationResult)
    assert result.content == "This is a test response."
    assert result.usage.input_tokens == 15
    assert result.usage.output_tokens == 10
    assert result.usage.total_tokens == 25
    assert result.latency_ms >= 0.0
    assert result.model == "gpt-4o-mini"
    assert result.finish_reason == "stop"


@patch("app.core.llm_client.OpenAI")
def test_llm_client_authentication_error(mock_openai_cls):
    """Verify LLMClient catches AuthenticationError and raises wrapped LLMClientError(401)."""
    mock_client_inst = MagicMock()
    mock_client_inst.chat.completions.create.side_effect = openai.AuthenticationError(
        message="Invalid API key",
        response=MagicMock(status_code=401),
        body={},
    )
    mock_openai_cls.return_value = mock_client_inst

    llm = LLMClient(api_key="invalid-key")
    with pytest.raises(LLMClientError) as exc_info:
        llm.generate(messages=[{"role": "user", "content": "Test"}])

    assert exc_info.value.status_code == 401
    assert "Authentication with OpenAI API failed" in exc_info.value.message


@patch("app.core.llm_client.OpenAI")
def test_llm_client_rate_limit_error(mock_openai_cls):
    """Verify LLMClient catches RateLimitError and raises wrapped LLMClientError(429)."""
    mock_client_inst = MagicMock()
    mock_client_inst.chat.completions.create.side_effect = openai.RateLimitError(
        message="Rate limit exceeded",
        response=MagicMock(status_code=429),
        body={},
    )
    mock_openai_cls.return_value = mock_client_inst

    llm = LLMClient(api_key="sk-test-key")
    with pytest.raises(LLMClientError) as exc_info:
        llm.generate(messages=[{"role": "user", "content": "Test"}])

    assert exc_info.value.status_code == 429
    assert "rate limit exceeded" in exc_info.value.message


@patch("app.core.llm_client.OpenAI")
def test_llm_client_groq_auto_detection(mock_openai_cls):
    """Verify Groq API key auto-configures Groq base URL and default model."""
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Groq response"
    mock_choice.finish_reason = "stop"
    mock_response.choices = [mock_choice]
    mock_response.model = "llama-3.3-70b-versatile"
    mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=10, total_tokens=20)

    mock_client_inst = MagicMock()
    mock_client_inst.base_url = "https://api.groq.com/openai/v1"
    mock_client_inst.chat.completions.create.return_value = mock_response
    mock_openai_cls.return_value = mock_client_inst

    # Test initialization with Groq key (starts with gsk_)
    llm = LLMClient(api_key="gsk_sample_groq_key_123")
    mock_openai_cls.assert_called_with(
        api_key="gsk_sample_groq_key_123",
        base_url="https://api.groq.com/openai/v1",
    )

    result = llm.generate(messages=[{"role": "user", "content": "Hello Groq"}])
    assert result.content == "Groq response"
    assert result.model == "llama-3.3-70b-versatile"

