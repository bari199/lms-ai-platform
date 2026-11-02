from app.core.cloudflare import cloudflare_ai


EMBEDDING_DIMENSIONS = 768


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate and validate Cloudflare embeddings for text inputs."""

    if not texts:
        return []

    if any(not text.strip() for text in texts):
        raise ValueError("Embedding input cannot contain empty text.")

    embeddings = await cloudflare_ai.generate_embeddings(texts)

    if len(embeddings) != len(texts):
        raise RuntimeError("Embedding count does not match input count.")

    for embedding in embeddings:
        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise RuntimeError(
                f"Expected {EMBEDDING_DIMENSIONS} dimensions, "
                f"received {len(embedding)}."
            )

    return embeddings
