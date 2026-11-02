import asyncio
from app.rag.embeddings import generate_embeddings


async def main():
    texts = [
        "What is machine learning?",
        "Artificial intelligence helps computers learn from data.",
    ]

    embeddings = await generate_embeddings(texts)

    print("Input count:", len(texts))
    print("Embedding count:", len(embeddings))
    print("Embedding dimensions:", len(embeddings[0]))
    print("Empty input:", await generate_embeddings([]))
    print("Validation:", len(embeddings) == 2 and all(len(e) == 768 for e in embeddings))


if __name__ == "__main__":
    asyncio.run(main())
