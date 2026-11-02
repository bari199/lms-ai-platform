
from uuid import UUID

from app.rag.embeddings import generate_embeddings


async def retrieve_relevant_chunks(
    pool,
    course_id: str,
    query: str,
    limit: int = 5,
) -> list[dict]:
    """Retrieve relevant course chunks with lecture citation details."""

    if not query or not query.strip():
        return []

    if not 1 <= limit <= 20:
        raise ValueError("limit must be between 1 and 20")

    try:
        course_uuid = UUID(course_id)
    except ValueError as exc:
        raise ValueError("Invalid course_id") from exc

    embeddings = await generate_embeddings([query])
    query_embedding = embeddings[0]

    vector_string = "[" + ",".join(
        str(float(value)) for value in query_embedding
    ) + "]"

    sql = """
        SELECT
            dc.id,
            dc.course_id,
            dc.lecture_id,
            l.title AS lecture_title,
            dc.chunk_text,
            (1 - (dc.embedding <=> $2::vector))::float AS similarity
        FROM document_chunks dc
        JOIN lectures l ON l.id = dc.lecture_id
        WHERE dc.course_id = $1
        ORDER BY dc.embedding <=> $2::vector
        LIMIT $3
    """

    async with pool.acquire() as connection:
        rows = await connection.fetch(
            sql,
            course_uuid,
            vector_string,
            limit,
        )

    return [dict(row) for row in rows]
