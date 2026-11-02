
import asyncio
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_FILE, override=True)

COURSE_ID = "37721008-5f01-4360-b60c-dbb54bcb17b9"
INSTRUCTOR_ID = "fa5f00b7-ff05-424e-bc43-d1ba8d9592ac"


async def main():
    token = os.getenv("AI_SERVICE_INTERNAL_TOKEN")

    if not token:
        raise RuntimeError("Internal token is not configured")

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"http://127.0.0.1:8001/internal/courses/{COURSE_ID}/index",
            params={"instructor_id": INSTRUCTOR_ID},
            headers={"X-Internal-Token": token},
        )

        print("HTTP Status:", response.status_code)
        print("Response:", response.text)
        response.raise_for_status()


if __name__ == "__main__":
    asyncio.run(main())
