
import json
import traceback
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.cloudflare import cloudflare_ai
from app.core.security import verify_internal_token


router = APIRouter(
    prefix="/internal",
    tags=["Internal AI Service"],
    dependencies=[Depends(verify_internal_token)],
)


# Request / Response Schemas

class StudyPlanRequest(BaseModel):
    student_id: UUID


class FocusArea(BaseModel):
    topic: str
    reason: str
    recommended_action: str


class DailyTask(BaseModel):
    day: str
    topic: str
    activity: str
    duration_minutes: int = Field(ge=10, le=180)


class GeneratedStudyPlan(BaseModel):
    summary: str
    strengths: list[str]
    focus_areas: list[FocusArea]
    weekly_plan: list[DailyTask]
    weekly_goal: str


# Structured JSON Schema

def build_study_plan_schema() -> dict:
    return {
        "type": "json_schema",
        "json_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "focus_areas": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "reason": {"type": "string"},
                            "recommended_action": {"type": "string"},
                        },
                        "required": [
                            "topic",
                            "reason",
                            "recommended_action",
                        ],
                    },
                },
                "weekly_plan": {
                    "type": "array",
                    "minItems": 7,
                    "maxItems": 7,
                    "items": {
                        "type": "object",
                        "properties": {
                            "day": {"type": "string"},
                            "topic": {"type": "string"},
                            "activity": {"type": "string"},
                            "duration_minutes": {
                                "type": "integer",
                                "minimum": 10,
                                "maximum": 180,
                            },
                        },
                        "required": [
                            "day",
                            "topic",
                            "activity",
                            "duration_minutes",
                        ],
                    },
                },
                "weekly_goal": {"type": "string"},
            },
            "required": [
                "summary",
                "strengths",
                "focus_areas",
                "weekly_plan",
                "weekly_goal",
            ],
        },
    }


def parse_study_plan_response(response: str) -> dict:
    if not isinstance(response, str) or not response.strip():
        raise ValueError("Cloudflare returned an empty response")

    cleaned = response.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        cleaned = "\n".join(lines).strip()

    data = json.loads(cleaned)

    if not isinstance(data, dict):
        raise ValueError("Study plan must be a JSON object")

    return data


# Generate Personalized Study Plan

@router.post("/study-plan")
async def generate_study_plan(
    payload: StudyPlanRequest,
    request: Request,
):
    pool = request.app.state.db_pool

    # 1. Fetch submitted quiz history
    async with pool.acquire() as connection:
        history = await connection.fetch(
            """
            SELECT
                q.title AS quiz_title,
                m.title AS module_title,
                c.title AS course_title,
                qa.score,
                qa.submitted_at
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN modules m ON m.id = q.module_id
            JOIN courses c ON c.id = m.course_id
            WHERE qa.user_id = $1
              AND qa.submitted_at IS NOT NULL
              AND c.status = 'approved'
            ORDER BY qa.submitted_at DESC
            LIMIT 20
            """,
            payload.student_id,
        )

    if not history:
        raise HTTPException(
            status_code=404,
            detail="QUIZ_HISTORY_NOT_FOUND",
        )

    # 2. Prepare learner performance data
    attempts = [
        {
            "quiz_title": row["quiz_title"],
            "module_title": row["module_title"],
            "course_title": row["course_title"],
            "score": float(row["score"]),
            "submitted_at": row["submitted_at"].isoformat(),
        }
        for row in history
    ]

    average_score = round(
        sum(item["score"] for item in attempts) / len(attempts),
        2,
    )

    # 3. Prepare AI instructions
    messages = [
        {
            "role": "system",
            "content": (
                "You are a personalized educational study planner. "
                "Analyze the student's quiz history and create a "
                "realistic seven-day study plan. "
                "Identify strengths and weak topics using quiz scores. "
                "Consider repeated attempts and recent improvements. "
                "Do not assume that one low score proves a topic is weak "
                "if later attempts show improvement. "
                "Prioritize topics that need revision. "
                "Use only the supplied performance data. "
                "Do not invent course content. "
                "Return only JSON matching the supplied schema."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Quiz attempts: {json.dumps(attempts)}\n\n"
                f"Average score: {average_score}%\n"
                f"Total submitted attempts: {len(attempts)}\n\n"
                "Create a personalized seven-day study plan."
            ),
        },
    ]

    try:
        # 4. Generate structured study plan
        response = await cloudflare_ai.generate_response(
            messages=messages,
            max_tokens=2500,
            response_format=build_study_plan_schema(),
        )

        # 5. Parse and validate
        plan_data = parse_study_plan_response(response)

        plan = GeneratedStudyPlan.model_validate(plan_data)

        if len(plan.weekly_plan) != 7:
            raise ValueError("Exactly seven daily tasks are required")

        # 6. Return study plan
        return {
            "student_id": str(payload.student_id),
            "performance": {
                "average_score": average_score,
                "total_attempts": len(attempts),
            },
            "study_plan": plan.model_dump(),
        }

    except HTTPException:
        raise

    except Exception as error:
        print("\n========== STUDY PLAN GENERATION ERROR ==========")
        print("Error type:", type(error).__name__)
        print("Error message:", repr(error))
        traceback.print_exc()
        print("=================================================\n")

        raise HTTPException(
            status_code=502,
            detail="STUDY_PLAN_GENERATION_FAILED",
        ) from error
