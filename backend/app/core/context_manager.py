"""Context Budget Manager & Compression Engine (Gatekeeper Stage).

Handles deterministic context budgeting, ranking, compression, and pruning
to ensure LLM requests strictly adhere to token window limits.
"""

import math
import logging
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.requests import ContextItem, ConversationMessage

logger = logging.getLogger(__name__)


class ItemCategory(str, Enum):
    SYSTEM = "system"
    USER_MESSAGE = "user_message"
    CONVERSATION_HISTORY = "conversation_history"
    CONTEXT_DOCUMENT = "context_document"
    TOOL_OUTPUT = "tool_output"


def estimate_tokens(text: str) -> int:
    """Estimate token count for a text string using a standard character-ratio approximation.

    Approximation rule: 1 token ≈ 4 characters (min 1 token for non-empty string).
    """
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4.0))


class BudgetableItem(BaseModel):
    """Internal item representation used for scoring and context budgeting."""

    source: str
    text: str
    approx_tokens: int
    importance_score: float = Field(default=1.0, ge=0.0, le=1.0)
    recency_score: float = Field(default=1.0, ge=0.0, le=1.0)
    category: ItemCategory
    role: str = "user"

    @property
    def rank_score(self) -> float:
        """Composite priority score combining importance and recency."""
        return (0.6 * self.importance_score) + (0.4 * self.recency_score)


class ManagedContext(BaseModel):
    """Output structure returned by ContextManager."""

    messages: List[Dict[str, str]] = Field(..., description="Ordered message objects for LLM consumption")
    input_tokens_estimate: int = Field(..., description="Final estimated input tokens allocated")
    original_tokens_estimate: int = Field(..., description="Original estimated tokens before compression/pruning")
    compression_ratio: float = Field(..., description="Ratio of final tokens to original tokens")
    dropped_items: List[str] = Field(default_factory=list, description="Sources of items dropped from budget")
    compressed_items_count: int = Field(default=0, description="Number of items that underwent compression")


class ContextManager:
    """Deterministic Context Budget Manager."""

    @staticmethod
    def _compress_item_text(text: str) -> str:
        """Heuristic text compression for MVP context compression.

        Preserves key head & tail sentences while removing repetitive fluff.
        """
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if len(lines) <= 2:
            # Short text: truncate to 60% length
            target_len = max(30, int(len(text) * 0.6))
            return text[:target_len] + "..." if len(text) > target_len else text

        # Select first line and last line as core summary representation
        compressed = f"{lines[0]} ... [compressed history] ... {lines[-1]}"
        return compressed

    @classmethod
    def build(
        cls,
        system_prompt: str,
        conversation: List[ConversationMessage],
        context_items: List[ContextItem],
        user_message: str,
        max_context_tokens: int = 4000,
        output_reserve_tokens: int = 500,
        llm_client: Optional[Any] = None,
    ) -> ManagedContext:
        """Builds a managed context strictly fitting within max_context_tokens.

        Args:
            system_prompt: Core system directives (never compressed/dropped).
            conversation: Prior conversation turns.
            context_items: Retrieved documents or background context.
            user_message: Active user query (never compressed/dropped).
            max_context_tokens: Hard upper bound on total input context tokens.
            output_reserve_tokens: Budget reserved for LLM response generation.
            llm_client: Optional LLMClient instance for LLM-assisted compression.

        Returns:
            ManagedContext with compiled message array and compression metrics.
        """
        dropped_items: List[str] = []
        compressed_count = 0

        # Step 1: Mandatory reserved items (System Prompt & Active User Message)
        sys_item = BudgetableItem(
            source="system_instructions",
            text=system_prompt,
            approx_tokens=estimate_tokens(system_prompt),
            importance_score=1.0,
            recency_score=1.0,
            category=ItemCategory.SYSTEM,
            role="system",
        )

        user_item = BudgetableItem(
            source="current_user_message",
            text=user_message,
            approx_tokens=estimate_tokens(user_message),
            importance_score=1.0,
            recency_score=1.0,
            category=ItemCategory.USER_MESSAGE,
            role="user",
        )

        mandatory_tokens = sys_item.approx_tokens + user_item.approx_tokens
        effective_max_tokens = max(mandatory_tokens, max_context_tokens - output_reserve_tokens)

        # Step 2: Build list of flexible items (Conversation History & Context Documents)
        flexible_items: List[BudgetableItem] = []

        total_conv = len(conversation)
        for idx, msg in enumerate(conversation):
            # Recency score increases with index
            recency = (idx + 1) / max(1, total_conv)
            flexible_items.append(
                BudgetableItem(
                    source=f"conversation_turn_{idx+1}",
                    text=msg.content,
                    approx_tokens=estimate_tokens(msg.content),
                    importance_score=0.8,
                    recency_score=recency,
                    category=ItemCategory.CONVERSATION_HISTORY,
                    role=msg.role,
                )
            )

        for idx, item in enumerate(context_items):
            flexible_items.append(
                BudgetableItem(
                    source=f"context_item_{idx+1}_{item.type}",
                    text=item.content,
                    approx_tokens=estimate_tokens(item.content),
                    importance_score=item.importance,
                    recency_score=0.5,  # Default mid recency for background docs
                    category=ItemCategory.CONTEXT_DOCUMENT,
                    role="system",
                )
            )

        # Compute original tokens estimate before pruning/compression
        original_tokens = mandatory_tokens + sum(item.approx_tokens for item in flexible_items)

        # Current total input tokens
        current_tokens = original_tokens

        # Step 3: Check if budgeting is necessary
        if current_tokens > effective_max_tokens:
            logger.info(
                f"Context budget exceeded ({current_tokens} > {effective_max_tokens}). Initiating Gatekeeper ranking & compression."
            )

            # Sort flexible items by rank_score ascending (lowest priority first)
            flexible_items.sort(key=lambda x: x.rank_score)

            # Attempt 1: Compress lower-priority items
            for item in flexible_items:
                if current_tokens <= effective_max_tokens:
                    break

                # Compress conversation history or context documents
                if item.approx_tokens > 20:
                    old_tokens = item.approx_tokens
                    compressed_text = cls._compress_item_text(item.text)
                    new_tokens = estimate_tokens(compressed_text)

                    if new_tokens < old_tokens:
                        item.text = compressed_text
                        item.approx_tokens = new_tokens
                        current_tokens -= (old_tokens - new_tokens)
                        compressed_count += 1

            # Attempt 2: Drop lowest-value items if still over budget
            retained_flexible_items: List[BudgetableItem] = []
            for item in flexible_items:
                if current_tokens > effective_max_tokens:
                    current_tokens -= item.approx_tokens
                    dropped_items.append(item.source)
                else:
                    retained_flexible_items.append(item)

            flexible_items = retained_flexible_items

        # Step 4: Re-order items chronologically / logically for final compilation
        final_messages: List[Dict[str, str]] = []

        # System prompt first
        if sys_item.text:
            final_messages.append({"role": "system", "content": sys_item.text})

        # Context documents (injected as background context)
        context_docs = [it for it in flexible_items if it.category == ItemCategory.CONTEXT_DOCUMENT]
        if context_docs:
            combined_context = "\n\n".join([f"--- Context ({it.source}) ---\n{it.text}" for it in context_docs])
            final_messages.append({"role": "system", "content": f"Relevant Context:\n{combined_context}"})

        # Conversation history
        conv_turns = [it for it in flexible_items if it.category == ItemCategory.CONVERSATION_HISTORY]
        # Preserve original order of conversation turns
        conv_turns.sort(key=lambda x: int(x.source.split("_")[-1]) if x.source.startswith("conversation_turn_") else 0)
        for turn in conv_turns:
            final_messages.append({"role": turn.role, "content": turn.text})

        # Current user message last
        final_messages.append({"role": "user", "content": user_item.text})

        final_input_tokens = sum(estimate_tokens(m["content"]) for m in final_messages)
        if dropped_items or compressed_count > 0:
            compression_ratio = round(final_input_tokens / max(1, original_tokens), 2)
        else:
            compression_ratio = 1.0

        return ManagedContext(
            messages=final_messages,
            input_tokens_estimate=final_input_tokens,
            original_tokens_estimate=max(original_tokens, final_input_tokens),
            compression_ratio=min(1.0, compression_ratio),
            dropped_items=dropped_items,
            compressed_items_count=compressed_count,
        )
