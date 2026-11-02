from uuid import UUID

from app.rag.chunking import chunk_text
from app.rag.embeddings import generate_embeddings


async def index_course_transcripts(
    pool,
    course_id: str,
    instructor_id: str,
) -> dict:
    """Index transcripts for an approved course owned by the instructor."""

    try:
        course_uuid = UUID(course_id)
        instructor_uuid = UUID(instructor_id)
    except ValueError as exc:
        raise ValueError("Invalid course_id or instructor_id") from exc

    async with pool.acquire() as connection:
        course = await connection.fetchrow(
            """
            SELECT status
            FROM courses
            WHERE id = $1 AND instructor_id = $2
            """,
            course_uuid,
            instructor_uuid,
        )

        if course is None:
            raise PermissionError(
                "Course not found or instructor access denied"
            )

        if course["status"] != "approved":
            raise PermissionError("Only approved courses can be indexed")

        lectures = await connection.fetch(
            """
            SELECT l.id AS lecture_id, l.transcript
            FROM lectures l
            JOIN modules m ON m.id = l.module_id
            WHERE m.course_id = $1
              AND l.transcript IS NOT NULL
              AND BTRIM(l.transcript) <> ''
            ORDER BY m.order_index, l.order_index
            """,
            course_uuid,
        )

        indexed_chunks = []

        for lecture in lectures:
            for chunk in chunk_text(lecture["transcript"]):
                indexed_chunks.append({
                    "lecture_id": lecture["lecture_id"],
                    "chunk_text": chunk,
                })

        if not indexed_chunks:
            return {
                "course_id": str(course_uuid),
                "lectures_found": len(lectures),
                "chunks_created": 0,
                "status": "no_transcripts",
            }

        texts = [item["chunk_text"] for item in indexed_chunks]
        embeddings = await generate_embeddings(texts)

        async with connection.transaction():
            await connection.execute(
                "DELETE FROM document_chunks WHERE course_id = $1",
                course_uuid,
            )

            await connection.executemany(
                """
                INSERT INTO document_chunks
                    (course_id, lecture_id, chunk_text, embedding)
                VALUES ($1, $2, $3, $4::vector)
                """,
                [
                    (
                        course_uuid,
                        item["lecture_id"],
                        item["chunk_text"],
                        "[" + ",".join(map(str, embedding)) + "]",
                    )
                    for item, embedding in zip(indexed_chunks, embeddings)
                ],
            )

    return {
        "course_id": str(course_uuid),
        "lectures_found": len(lectures),
        "chunks_created": len(indexed_chunks),
        "status": "indexed",
    }
