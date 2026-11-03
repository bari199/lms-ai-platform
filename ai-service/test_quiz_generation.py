
import os
import httpx

from pathlib import Path
from dotenv import load_dotenv


load_dotenv(
    Path(__file__).resolve().parent / ".env",
    override=True,
)

BASE_URL = "http://127.0.0.1:8001"

LECTURE_ID = "4c750244-e56d-4239-8f86-7e0238fdbf89"

INSTRUCTOR_ID = "fa5f00b7-ff05-424e-bc43-d1ba8d9592ac"

token = os.getenv("AI_SERVICE_INTERNAL_TOKEN")

if not token:
    raise RuntimeError("AI_SERVICE_INTERNAL_TOKEN is missing")


response = httpx.post(
    f"{BASE_URL}/internal/lectures/{LECTURE_ID}/generate-quiz",
    headers={
        "X-Internal-Token": token,
    },
    json={
        "instructor_id": INSTRUCTOR_ID,
        "question_count": 5,
    },
    timeout=120.0,
)

print("HTTP Status:", response.status_code)

try:
    data = response.json()
except ValueError:
    print(response.text)
    raise

if response.is_success:
    quiz = data["quiz"]

    print("\nQuiz Title:", quiz["title"])
    print("Total Questions:", len(quiz["questions"]))

    for index, question in enumerate(quiz["questions"], start=1):
        print(f"\nQuestion {index}: {question['question_text']}")

        for option in question["options"]:
            marker = "Correct" if option["is_correct"] else "Incorrect"
            print(f"  - {option['option_text']} ({marker})")

    print("\nApproval Status:", data["approval_status"])

else:
    print("Error Response:", data)
