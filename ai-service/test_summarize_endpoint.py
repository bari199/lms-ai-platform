
import os
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

BASE_URL = "http://127.0.0.1:8001"
LECTURE_ID = "4c750244-e56d-4239-8f86-7e0238fdbf89"

token = os.getenv("AI_SERVICE_INTERNAL_TOKEN")

if not token:
    raise RuntimeError("AI_SERVICE_INTERNAL_TOKEN is missing")

response = httpx.post(
    f"{BASE_URL}/internal/lectures/{LECTURE_ID}/summarize",
    headers={"X-Internal-Token": token},
    timeout=90.0,
)

print("HTTP Status:", response.status_code)
print("Response:")

try:
    print(response.json())
except ValueError:
    print(response.text)
