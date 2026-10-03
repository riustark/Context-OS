"""Prompt Compiler & Versioning Engine (Assembly Line Stage).

Packages system directives, task policies, context structures, and output schemas
into standardized prompt message arrays tagged with version identifiers.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.core.context_manager import ManagedContext
from app.models.requests import TaskType


class PromptVersion(str, Enum):
    V1 = "v1"
    V2 = "v2"


TASK_POLICIES: Dict[TaskType, str] = {
    TaskType.FACTUAL: (
        "Provide accurate, precise, and evidence-backed factual information. "
        "Rely strictly on established facts and provided context without speculation."
    ),
    TaskType.ANALYTICAL: (
        "Analyze the problem methodically. Break down key concepts, weigh trade-offs, "
        "and present structured logical reasoning."
    ),
    TaskType.CREATIVE: (
        "Generate engaging, vivid, and original creative text tailored to the user's input, "
        "maintaining clear stylistic coherence."
    ),
    TaskType.CODE: (
        "Act as an expert software engineer. Produce clean, efficient, maintainable code. "
        "Explain key technical decisions and identify potential edge cases or bugs."
    ),
    TaskType.STRUCTURED_EXTRACTION: (
        "Extract structured information accurately from the provided text. "
        "Format the output strictly according to the specified JSON schema without conversational filler."
    ),
}

VERSION_SYSTEM_DIRECTIVES: Dict[PromptVersion, str] = {
    PromptVersion.V1: (
        "You are ContextOS AI runtime assistant. Follow all task policies and user instructions carefully."
    ),
    PromptVersion.V2: (
        "You are ContextOS AI runtime assistant v2. Adhere strictly to system policies, "
        "use step-by-step reasoning where appropriate, respect context boundaries, and output clean responses."
    ),
}


class PromptCompilationResult(BaseModel):
    """Output from the PromptEngine compilation process."""

    compiled_messages: List[Dict[str, str]] = Field(..., description="Final message array ready for LLM consumption")
    prompt_version: str = Field(..., description="Prompt version tag used (e.g. v1, v2)")
    task_type: TaskType = Field(..., description="Task policy classification applied")
    system_instruction: str = Field(..., description="Combined system directive and task policy instruction")


class PromptEngine:
    """Prompt Compiler engine for ContextOS."""

    @classmethod
    def get_task_policy(cls, task_type: TaskType) -> str:
        """Retrieve task policy string for a given TaskType."""
        return TASK_POLICIES.get(
            task_type,
            "Provide a helpful, accurate, and concise response to the user query.",
        )

    @classmethod
    def get_system_directive(cls, version: PromptVersion = PromptVersion.V1) -> str:
        """Retrieve base system directive for a given PromptVersion."""
        return VERSION_SYSTEM_DIRECTIVES.get(version, VERSION_SYSTEM_DIRECTIVES[PromptVersion.V1])

    @classmethod
    def compile(
        cls,
        task_type: TaskType,
        managed_context: ManagedContext,
        prompt_version: str = "v1",
        output_format_instructions: Optional[str] = None,
    ) -> PromptCompilationResult:
        """Compiles system directive, task policy, and managed context into final message array.

        Args:
            task_type: Classification of the request (e.g., code, factual, analytical).
            managed_context: ManagedContext instance produced by ContextManager.
            prompt_version: Prompt version string ('v1' or 'v2').
            output_format_instructions: Optional custom output format directive (e.g., JSON schema).

        Returns:
            PromptCompilationResult with compiled messages and version tag.
        """
        # Resolve prompt version enum
        try:
            version_enum = PromptVersion(prompt_version.lower())
        except ValueError:
            version_enum = PromptVersion.V1

        base_directive = cls.get_system_directive(version_enum)
        task_policy = cls.get_task_policy(task_type)

        combined_system_header = f"{base_directive}\n\nTask Policy ({task_type.value}):\n{task_policy}"
        if output_format_instructions:
            combined_system_header += f"\n\nOutput Format Instructions:\n{output_format_instructions}"

        # Combine with managed context messages
        compiled_messages: List[Dict[str, str]] = []
        has_system_msg = False

        for msg in managed_context.messages:
            if msg["role"] == "system" and not has_system_msg:
                # Merge combined system header into top system message
                merged_content = f"{combined_system_header}\n\n{msg['content']}" if msg['content'] else combined_system_header
                compiled_messages.append({"role": "system", "content": merged_content})
                has_system_msg = True
            else:
                compiled_messages.append(msg)

        if not has_system_msg:
            compiled_messages.insert(0, {"role": "system", "content": combined_system_header})

        return PromptCompilationResult(
            compiled_messages=compiled_messages,
            prompt_version=version_enum.value,
            task_type=task_type,
            system_instruction=combined_system_header,
        )
