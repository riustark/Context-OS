"""Unit tests for Stage 1 Gatekeeper (Context Budget Manager)."""

import pytest
from app.core.context_manager import ContextManager, estimate_tokens
from app.models.requests import ContextItem, ConversationMessage


def test_estimate_tokens():
    """Verify estimate_tokens calculation."""
    assert estimate_tokens("") == 0
    assert estimate_tokens("hello") == 2  # ceil(5/4) = 2
    assert estimate_tokens("a" * 400) == 100


def test_context_manager_within_budget():
    """Verify ContextManager preserves all messages when under token budget."""
    system_prompt = "You are a helpful coding assistant."
    conversation = [
        ConversationMessage(role="user", content="Hi"),
        ConversationMessage(role="assistant", content="Hello! How can I help you today?"),
    ]
    context_items = [
        ContextItem(type="document", content="Doc content here.", importance=0.8)
    ]
    user_message = "Write a python function to add two numbers."

    result = ContextManager.build(
        system_prompt=system_prompt,
        conversation=conversation,
        context_items=context_items,
        user_message=user_message,
        max_context_tokens=4000,
    )

    assert result.dropped_items == []
    assert result.compressed_items_count == 0
    assert result.compression_ratio == 1.0
    # Messages should include: system prompt, context doc, 2 conv turns, user message
    assert len(result.messages) == 5
    assert result.messages[0]["content"] == system_prompt
    assert result.messages[-1]["content"] == user_message


def test_context_manager_preserves_system_and_user_message():
    """Verify system prompt and user query are never dropped or modified even under tight budget."""
    system_prompt = "CRITICAL SYSTEM INSTRUCTION: DO NOT IGNORE."
    user_message = "URGENT USER QUERY."

    # Create large conversation history to exceed budget
    conversation = [
        ConversationMessage(role="user", content=f"Old message turn {i} " + "x" * 100)
        for i in range(10)
    ]

    result = ContextManager.build(
        system_prompt=system_prompt,
        conversation=conversation,
        context_items=[],
        user_message=user_message,
        max_context_tokens=150,  # Very tight token budget
        output_reserve_tokens=20,
    )

    # Verify system prompt and user message are present intact
    assert result.messages[0]["role"] == "system"
    assert result.messages[0]["content"] == system_prompt
    assert result.messages[-1]["role"] == "user"
    assert result.messages[-1]["content"] == user_message
    assert len(result.dropped_items) > 0  # Some history dropped to fit budget


def test_context_manager_drops_lowest_priority_first():
    """Verify ContextManager drops low importance context items before dropping recent conversation."""
    system_prompt = "System prompt"
    user_message = "User message"

    # High importance item vs low importance item
    high_importance_doc = ContextItem(type="doc", content="Crucial Doc " + "a" * 200, importance=1.0)
    low_importance_doc = ContextItem(type="doc", content="Unimportant Doc " + "b" * 200, importance=0.1)

    result = ContextManager.build(
        system_prompt=system_prompt,
        conversation=[],
        context_items=[low_importance_doc, high_importance_doc],
        user_message=user_message,
        max_context_tokens=50,  # Forces dropping low priority item
        output_reserve_tokens=10,
    )

    # Low importance doc should be dropped first
    assert any("context_item_1" in dropped for dropped in result.dropped_items)
