
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import create_db_pool
from app.routers.internal import router as internal_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await create_db_pool()

    try:
        yield
    finally:
        await app.state.db_pool.close()


app = FastAPI(
    title="LMS-AI Service",
    description="AI Tutor Service for the LMS platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(internal_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "lms-ai-service",
    }
