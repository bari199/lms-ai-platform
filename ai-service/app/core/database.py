import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(ROOT_ENV)


async def create_db_pool():
    return await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        database=os.getenv("POSTGRES_DB", "postgres"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD"),
        min_size=1,
        max_size=5,
    )


async def check_db_connection(pool):
    async with pool.acquire() as connection:
        return await connection.fetchval("SELECT current_database()")
