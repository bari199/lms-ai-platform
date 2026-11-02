import os
from pathlib import Path

import httpx
from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=True)

load_dotenv()


class CloudflareAI:
    def __init__(self):
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.chat_model = os.getenv("CLOUDFLARE_CHAT_MODEL")
        self.embedding_model = os.getenv("CLOUDFLARE_EMBEDDING_MODEL")

        if not all([
            self.account_id,
            self.api_token,
            self.chat_model,
            self.embedding_model,
        ]):
            raise RuntimeError("Cloudflare configuration is incomplete.")

        self.base_url = (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{self.account_id}/ai/run"
        )

        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    async def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/{self.embedding_model}",
                headers=self.headers,
                json={"text": texts},
            )

            response.raise_for_status()
            data = response.json()

        if not data.get("success"):
            raise RuntimeError("Cloudflare embedding request failed.")

        embeddings = data["result"]["data"]

        if len(embeddings) != len(texts):
            raise RuntimeError("Invalid embedding response.")

        return embeddings

    async def generate_response(
        self,
        messages: list[dict[str, str]],
    ) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/{self.chat_model}",
                headers=self.headers,
                json={"messages": messages},
            )

            response.raise_for_status()
            data = response.json()

        if not data.get("success"):
            raise RuntimeError("Cloudflare chat request failed.")

        return data["result"]["response"]


cloudflare_ai = CloudflareAI()
