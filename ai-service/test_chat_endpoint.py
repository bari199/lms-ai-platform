
from uuid import UUID

from app.rag.chunking import chunk_text
from app.rag.embeddings import generate_embeddings


async def index_course_transcripts(
    pool,
    course_id: str,
    instructor_id: str,
) -> dict:
    """Index approved course transcripts, replacing chunks per lecture."""

    try:
        course_uuid = UUID(course_id)
        instructor_uuid = UUID(instructor_id)
    except ValueError as exc:
        raise ValueError("Invalid course_id or instructor_id") from exc

    lectures_found = 0
    total_chunks = 0

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

        for lecture in lectures:
            chunks = chunk_text(lecture["transcript"])

            if not chunks:
                continue

            embeddings = []

            for offset in range(0, len(chunks), 64):
                batch = chunks[offset:offset + 64]
                batch_embeddings = await generate_embeddings(batch)
                embeddings.extend(batch_embeddings)

            if len(embeddings) != len(chunks):
                raise RuntimeError("Embedding count mismatch")

            async with connection.transaction():
                await connection.execute(
                    """
                    DELETE FROM document_chunks
                    WHERE course_id = $1 AND lecture_id = $2
                    """,
                    course_uuid,
                    lecture["lecture_id"],
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
                            lecture["lecture_id"],
                            chunk,
                            "[" + ",".join(map(str, embedding)) + "]",
                        )
                        for chunk, embedding in zip(chunks, embeddings)
                    ],
                )

            lectures_found += 1
            total_chunks += len(chunks)

    return {
        "course_id": str(course_uuid),
        "lectures_found": lectures_found,
        "chunks_created": total_chunks,
        "status": "indexed" if total_chunks else "no_transcripts",
    }
