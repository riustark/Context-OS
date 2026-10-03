"""Request schemas for ContextOS API endpoints."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    FACTUAL = "factual"
    ANALYTICAL = "analytical"
    CREATIVE = "creative"
    CODE = "code"
    STRUCTURED_EXTRACTION = "structured_extraction"


class ConversationMessage(BaseModel):
    role: str = Field(..., description="Role of the message author (e.g., user, assistant, system)")
    content: str = Field(..., description="Content of the message")


class ContextItem(BaseModel):
    type: str = Field(default="document", description="Type of context item (e.g., document, code_snippet, memory)")
    content: str = Field(..., description="Textual content of the context item")
    importance: float = Field(default=1.0, ge=0.0, le=1.0, description="Priority weight for retention")


class ChatRequest(BaseModel):
    message: str = Field(..., description="Current user input query or message")
    conversation: List[ConversationMessage] = Field(default_factory=list, description="Prior conversation history")
    context: List[ContextItem] = Field(default_factory=list, description="Retrieved or uploaded background context")
    task_type: TaskType = Field(default=TaskType.FACTUAL, description="Classification of the request task")
    max_context_tokens: Optional[int] = Field(default=4000, description="Max token budget allocated for context")
    model: Optional[str] = Field(default=None, description="Optional model identifier override")
