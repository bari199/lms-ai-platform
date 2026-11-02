
import asyncio

from app.core.database import create_db_pool
from app.rag.indexer import index_course_transcripts


COURSE_ID = "37721008-5f01-4360-b60c-dbb54bcb17b9"
INSTRUCTOR_ID = "fa5f00b7-ff05-424e-bc43-d1ba8d9592ac"


async def main():
    pool = await create_db_pool()

    try:
        result = await index_course_transcripts(
            pool,
            COURSE_ID,
            INSTRUCTOR_ID,
        )

        print("Indexing result:")
        print(result)

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
