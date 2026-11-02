import asyncio
from app.core.cloudflare import cloudflare_ai


async def main():
    embeddings = await cloudflare_ai.generate_embeddings([
        "What is machine learning?"
    ])

    print("Embedding count:", len(embeddings))
    print("Embedding dimensions:", len(embeddings[0]))

    answer = await cloudflare_ai.generate_response([
        {
            "role": "user",
            "content": "Reply with exactly: FastAPI Cloudflare client works."
        }
    ])

    print("Chat response:", answer)


if __name__ == "__main__":
    asyncio.run(main())
