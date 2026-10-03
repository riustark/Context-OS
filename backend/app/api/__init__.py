"""API routes package."""

from fastapi import APIRouter
from app.api.routes_chat import router as chat_router
from app.api.routes_evaluation import router as evaluation_router
from app.api.routes_metrics import router as metrics_router

api_router = APIRouter()
api_router.include_router(chat_router, tags=["chat"])
api_router.include_router(evaluation_router, tags=["evaluation"])
api_router.include_router(metrics_router, tags=["metrics"])

__all__ = ["api_router"]
