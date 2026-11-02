import os
import httpx
from dotenv import load_dotenv

load_dotenv()

account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
api_token = os.getenv("CLOUDFLARE_API_TOKEN")
model = os.getenv("CLOUDFLARE_EMBEDDING_MODEL")

if not all([account_id, api_token, model]):
    raise RuntimeError("Missing Cloudflare configuration.")

url = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{account_id}/ai/run/{model}"
)

response = httpx.post(
    url,
    headers={"Authorization": f"Bearer {api_token}"},
    json={
        "text": [
            "What is machine learning?",
            "Machine learning enables computers to learn from data."
        ]
    },
    timeout=60.0,
)

if response.is_error:
    print("HTTP Status:", response.status_code)
    print("API Error:", response.text)
else:
    result = response.json()
    embeddings = result["result"]["data"]

    print("API success:", result["success"])
    print("Number of embeddings:", len(embeddings))
    print("Embedding dimensions:", len(embeddings[0]))
