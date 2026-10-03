"""Chat API routes implementing end-to-end ContextOS execution flow."""

import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.context_manager import ContextManager
from app.core.inference_policy import InferencePolicyEngine
from app.core.llm_client import LLMClient, LLMClientError
from app.core.prompt_engine import PromptEngine
from app.db.database import get_db
from app.db.repositories import RunRepository
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse, MetricsData, PolicyData

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Execute LLM request through ContextOS Gatekeeper -> Assembly Line -> Dispatcher pipeline."""
    request_id = str(uuid.uuid4())

    # Step 1: Gatekeeper (Context Budgeting & Compression)
    managed_context = ContextManager.build(
        system_prompt="You are ContextOS AI assistant.",
        conversation=request.conversation,
        context_items=request.context,
        user_message=request.message,
        max_context_tokens=request.max_context_tokens or 4000,
    )

    # Step 2: Assembly Line (Prompt Compilation & Versioning)
    compilation_result = PromptEngine.compile(
        task_type=request.task_type,
        managed_context=managed_context,
        prompt_version="v1",
    )

    # Step 3: Dispatcher (Adaptive Inference Policy Selection)
    policy = InferencePolicyEngine.select(
        task_type=request.task_type,
        context_size=managed_context.input_tokens_estimate,
        model_override=request.model,
    )

    # Step 4: Call LLM Client (OpenAI Integration)
    llm_client = LLMClient()
    try:
        generation_result = llm_client.generate(
            messages=compilation_result.compiled_messages,
            model=policy.model,
            temperature=policy.temperature,
            max_output_tokens=policy.max_output_tokens,
        )
    except LLMClientError as err:
        logger.error(f"Chat execution failed for request {request_id}: {err.message}")
        raise HTTPException(
            status_code=err.status_code or 500,
            detail=f"LLM Generation Error: {err.message}",
        )

    # Step 5: Persist run record to database
    try:
        repo = RunRepository(db)
        repo.create_run(
            request_id=request_id,
            task_type=request.task_type.value,
            model=generation_result.model,
            prompt_version=compilation_result.prompt_version,
            input_tokens=generation_result.usage.input_tokens,
            output_tokens=generation_result.usage.output_tokens,
            latency_ms=generation_result.latency_ms,
            compression_ratio=managed_context.compression_ratio,
            status="success",
        )
    except Exception as db_err:
        logger.warning(f"Failed to persist run metadata for request {request_id}: {db_err}")

    # Step 6: Format Response & Operational Metrics
    return ChatResponse(
        request_id=request_id,
        answer=generation_result.content,
        usage=generation_result.usage,
        metrics=MetricsData(
            latency_ms=generation_result.latency_ms,
            context_compression_ratio=managed_context.compression_ratio,
        ),
        policy=PolicyData(
            task_type=request.task_type.value,
            model=generation_result.model,
            temperature=policy.temperature,
            max_output_tokens=policy.max_output_tokens,
        ),
    )
