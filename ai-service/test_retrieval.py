
import asyncio

from app.core.database import create_db_pool
from app.rag.retriever import retrieve_relevant_chunks


COURSE_ID = "37721008-5f01-4360-b60c-dbb54bcb17b9"

QUESTION = "What is the difference between let and const in JavaScript?"


async def main():
    pool = await create_db_pool()

    try:
        chunks = await retrieve_relevant_chunks(
            pool=pool,
            course_id=COURSE_ID,
            query=QUESTION,
            limit=5,
        )

        print("Retrieved chunks:", len(chunks))

        for index, chunk in enumerate(chunks, start=1):
            print(f"\nSource [{index}]")
            print("Lecture:", chunk["lecture_title"])
            print("Similarity:", round(chunk["similarity"], 4))
            print("Content:", chunk["chunk_text"][:300])

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
