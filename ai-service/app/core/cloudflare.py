
import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv


# -----------------------------
# Environment Configuration
# -----------------------------

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=True)


# -----------------------------
# Cloudflare AI Client
# -----------------------------

class CloudflareAI:

    def __init__(self):
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")

        self.chat_model = os.getenv(
            "CLOUDFLARE_CHAT_MODEL",
            "@cf/meta/llama-3.1-8b-instruct",
        )

        self.embedding_model = os.getenv(
            "CLOUDFLARE_EMBEDDING_MODEL",
            "@cf/google/embeddinggemma-300m",
        )

        if not all([
            self.account_id,
            self.api_token,
            self.chat_model,
            self.embedding_model,
        ]):
            raise RuntimeError(
                "Cloudflare configuration is incomplete. "
                "Check ai-service/.env"
            )

        self.base_url = (
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{self.account_id}/ai/run"
        )

        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        self.timeout = httpx.Timeout(
            120.0,
            connect=30.0,
        )

    # -----------------------------
    # Generate Embeddings
    # -----------------------------

    async def generate_embeddings(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        if not texts:
            raise ValueError("Embedding input cannot be empty")

        async with httpx.AsyncClient(
            timeout=self.timeout
        ) as client:

            response = await client.post(
                f"{self.base_url}/{self.embedding_model}",
                headers=self.headers,
                json={
                    "text": texts,
                },
            )

            response.raise_for_status()
            data = response.json()

        if not data.get("success"):
            raise RuntimeError(
                f"Cloudflare embedding request failed: "
                f"{data.get('errors')}"
            )

        result = data.get("result") or {}
        embeddings = result.get("data")

        if not isinstance(embeddings, list):
            raise RuntimeError(
                "Cloudflare returned invalid embedding data"
            )

        if len(embeddings) != len(texts):
            raise RuntimeError(
                "Cloudflare embedding count mismatch"
            )

        return embeddings

    # -----------------------------
    # Generate AI Response
    # -----------------------------

    async def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1200,
        response_format: dict | None = None,
    ) -> str:

        request_body = {
            "messages": messages,
            "max_tokens": max_tokens,
        }

        # Optional structured JSON output.
        if response_format is not None:
            request_body["response_format"] = response_format

        async with httpx.AsyncClient(
            timeout=self.timeout
        ) as client:

            response = await client.post(
                f"{self.base_url}/{self.chat_model}",
                headers=self.headers,
                json=request_body,
            )

            response.raise_for_status()
            data = response.json()

        if not data.get("success"):
            raise RuntimeError(
                f"Cloudflare chat request failed: "
                f"{data.get('errors')}"
            )

        result = data.get("result") or {}
        output = result.get("response")

        # JSON Mode may return an object directly.
        if isinstance(output, dict):
            return json.dumps(
                output,
                ensure_ascii=False,
            )

        if not isinstance(output, str) or not output.strip():
            raise RuntimeError(
                "Cloudflare returned an empty or invalid response"
            )

        return output


# -----------------------------
# Shared Client Instance
# -----------------------------

cloudflare_ai = CloudflareAI()
