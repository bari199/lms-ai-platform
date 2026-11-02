import asyncio

from app.core.database import create_db_pool
from app.rag.indexer import index_course_transcripts


async def main():
    pool = await create_db_pool()

    try:
        await index_course_transcripts(
            pool,
            "37721008-5f01-4360-b60c-dbb54bcb17b9",
            "00000000-0000-0000-0000-000000000001",
        )

        print("Authorization test: FAIL")
        print("Unexpectedly allowed unauthorized instructor.")

    except PermissionError as error:
        print("Authorization test: PASS")
        print("Error:", error)

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())

