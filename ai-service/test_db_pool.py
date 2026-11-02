
import asyncio

from app.core.database import create_db_pool, check_db_connection


async def main():
    pool = await create_db_pool()

    try:
        database = await check_db_connection(pool)

        print("Database connection: SUCCESS")
        print("Database:", database)

        async with pool.acquire() as connection:
            result = await connection.fetchrow("""
                SELECT
                    COUNT(*) AS total_chunks,
                    COUNT(DISTINCT lecture_id) AS indexed_lectures
                FROM document_chunks
            """)

            print("Total indexed chunks:", result["total_chunks"])
            print("Indexed lectures:", result["indexed_lectures"])



        async with pool.acquire() as connection:
            lectures = await connection.fetch("""
                SELECT
                    l.id AS lecture_id,
                    l.title,
                    CASE
                        WHEN NULLIF(BTRIM(l.transcript), '') IS NULL
                        THEN 'MISSING'
                        ELSE 'AVAILABLE'
                    END AS transcript_status,
                    LENGTH(l.transcript) AS transcript_length
                FROM lectures l
                JOIN modules m ON m.id = l.module_id
                WHERE m.course_id = $1
                ORDER BY m.order_index, l.order_index
            """, "37721008-5f01-4360-b60c-dbb54bcb17b9")

            print("\nCourse lecture report:")

            for lecture in lectures:
                print(dict(lecture))

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
