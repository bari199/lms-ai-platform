import asyncio
from app.core.database import create_db_pool, check_db_connection


async def main():
    pool = await create_db_pool()

    try:
        database = await check_db_connection(pool)
        print("PostgreSQL connection: SUCCESS")
        print("Connected database:", database)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
