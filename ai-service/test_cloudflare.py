import os
import httpx
from dotenv import load_dotenv

load_dotenv()

account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
api_token = os.getenv("CLOUDFLARE_API_TOKEN")
model = os.getenv("CLOUDFLARE_CHAT_MODEL")

if not all([account_id, api_token, model]):
    raise RuntimeError("Missing Cloudflare environment configuration.")

url = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{account_id}/ai/run/{model}"
)

headers = {
    "Authorization": f"Bearer {api_token}",
    "Content-Type": "application/json",
}

payload = {
    "messages": [
        {
            "role": "user",
            "content": "Reply with exactly: Cloudflare AI connected successfully."
        }
    ]
}

response = httpx.post(
    url,
    headers=headers,
    json=payload,
    timeout=60.0,
)

if response.is_error:
    print("HTTP Status:", response.status_code)
    print("API Error:", response.text)
else:
    data = response.json()
    print("Cloudflare API success:", data.get("success"))
    print("AI Response:", data.get("result", {}).get("response"))
