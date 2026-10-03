"""Unit tests for Stage 3 Dispatcher (Adaptive Inference Policy Engine)."""

import pytest
from app.core.inference_policy import InferencePolicyEngine
from app.models.requests import TaskType


def test_inference_policy_mapping():
    """Verify task types map to expected temperatures and token limits."""
    code_policy = InferencePolicyEngine.select(TaskType.CODE)
    assert code_policy.temperature == 0.1
    assert code_policy.max_output_tokens == 1500

    creative_policy = InferencePolicyEngine.select(TaskType.CREATIVE)
    assert creative_policy.temperature == 0.7
    assert creative_policy.max_output_tokens == 1000

    factual_policy = InferencePolicyEngine.select(TaskType.FACTUAL)
    assert factual_policy.temperature == 0.1

    extraction_policy = InferencePolicyEngine.select(TaskType.STRUCTURED_EXTRACTION)
    assert extraction_policy.temperature == 0.0


def test_inference_policy_model_override():
    """Verify explicit model override is respected."""
    policy = InferencePolicyEngine.select(TaskType.CODE, model_override="gpt-4o")
    assert policy.model == "gpt-4o"
