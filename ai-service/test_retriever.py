import asyncio

from app.core.database import create_db_pool
from app.rag.retriever import retrieve_relevant_chunks


COURSE_ID = "37721008-5f01-4360-b60c-dbb54bcb17b9"


async def main():
    pool = await create_db_pool()

    try:
        results = await retrieve_relevant_chunks(
            pool=pool,
            course_id=COURSE_ID,
            query="What is machine learning?",
            limit=5,
        )

        print("Database connection: SUCCESS")
        print("Retrieved chunks:", len(results))
        print("Retrieval result:", results)

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
