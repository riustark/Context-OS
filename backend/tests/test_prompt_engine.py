"""Unit tests for Stage 2 Assembly Line (Prompt Compiler & Versioning)."""

import pytest
from app.core.context_manager import ContextManager
from app.core.prompt_engine import PromptCompilationResult, PromptEngine, PromptVersion
from app.models.requests import TaskType


def test_prompt_engine_task_policies():
    """Verify all TaskTypes map to valid policy strings."""
    for task_type in TaskType:
        policy = PromptEngine.get_task_policy(task_type)
        assert isinstance(policy, str)
        assert len(policy) > 10


def test_prompt_engine_versions():
    """Verify v1 and v2 prompt version directives resolve correctly."""
    v1_directive = PromptEngine.get_system_directive(PromptVersion.V1)
    v2_directive = PromptEngine.get_system_directive(PromptVersion.V2)

    assert "ContextOS" in v1_directive
    assert "v2" in v2_directive
    assert v1_directive != v2_directive


def test_prompt_engine_compilation_v1():
    """Verify PromptEngine compiles managed context into message array with v1 version tag."""
    managed_context = ContextManager.build(
        system_prompt="Base System Instruction",
        conversation=[],
        context_items=[],
        user_message="Explain binary search.",
        max_context_tokens=4000,
    )

    result = PromptEngine.compile(
        task_type=TaskType.CODE,
        managed_context=managed_context,
        prompt_version="v1",
    )

    assert isinstance(result, PromptCompilationResult)
    assert result.prompt_version == "v1"
    assert result.task_type == TaskType.CODE
    assert "Task Policy (code):" in result.system_instruction
    assert "expert software engineer" in result.system_instruction

    # Check top message is system containing task policy
    assert result.compiled_messages[0]["role"] == "system"
    assert "Task Policy (code):" in result.compiled_messages[0]["content"]

    # Check bottom message is user query
    assert result.compiled_messages[-1]["role"] == "user"
    assert result.compiled_messages[-1]["content"] == "Explain binary search."


def test_prompt_engine_compilation_v2_with_output_format():
    """Verify PromptEngine compiles v2 prompt with output format instructions."""
    managed_context = ContextManager.build(
        system_prompt="Extract metrics",
        conversation=[],
        context_items=[],
        user_message="JSON string here",
        max_context_tokens=4000,
    )

    format_instructions = 'Return JSON schema: {"key": "value"}'

    result = PromptEngine.compile(
        task_type=TaskType.STRUCTURED_EXTRACTION,
        managed_context=managed_context,
        prompt_version="v2",
        output_format_instructions=format_instructions,
    )

    assert result.prompt_version == "v2"
    assert "v2" in result.system_instruction
    assert format_instructions in result.system_instruction
