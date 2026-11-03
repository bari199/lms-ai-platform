
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import create_db_pool
from app.routers.internal import router as internal_router
from app.routers.summarize import router as summarize_router
from app.routers.quiz_gen import router as quiz_gen_router
from app.routers.flashcards import router as flashcards_router
from app.routers.study_plan import router as study_plan_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database connection pool
    app.state.db_pool = await create_db_pool()

    try:
        # Verify database connection
        async with app.state.db_pool.acquire() as conn:
            print(
                "AI SERVICE DATABASE:",
                await conn.fetchval("SELECT current_database()")
            )

            print(
                "AI SERVICE DATABASE HOST:",
                await conn.fetchval("SELECT inet_server_addr()::text")
            )

        yield

    finally:
        # Close database connection pool
        await app.state.db_pool.close()


app = FastAPI(
    title="LMS-AI Service",
    description="AI Tutor Service for the LMS platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(internal_router)
app.include_router(summarize_router)
app.include_router(quiz_gen_router)
app.include_router(flashcards_router)
app.include_router(study_plan_router)



@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "lms-ai-service",
    }
