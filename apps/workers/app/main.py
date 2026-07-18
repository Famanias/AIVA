"""
AIVA Workers — FastAPI Application Entry Point

Exposes pipeline stage endpoints that are called by the Node.js job dispatcher.
Each endpoint corresponds to one pipeline job_step.

No business logic lives here — endpoints delegate to stage handlers.
"""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import pipeline, health, assets, composition, telemetry

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(
        "aiva_workers_starting",
        llm_provider=settings.llm_provider,
        tts_provider=settings.tts_provider,
        search_provider=settings.search_provider,
        image_provider=settings.image_provider,
    )
    yield
    logger.info("aiva_workers_stopping")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AIVA Workers API",
        version="0.1.0",
        description="Pipeline stage handlers for AIVA video generation.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_app_url],
        allow_methods=["POST", "GET"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router, prefix="/health", tags=["Health"])
    app.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
    app.include_router(assets.router, prefix="/assets", tags=["Assets"])
    app.include_router(composition.router, prefix="/composition", tags=["Composition"])
    app.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetry"])

    return app


app = create_app()
