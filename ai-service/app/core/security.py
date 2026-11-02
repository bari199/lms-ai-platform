import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Header, HTTPException


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=True)


async def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    expected_token = os.getenv("AI_SERVICE_INTERNAL_TOKEN")

    if not expected_token:
        raise HTTPException(
            status_code=503,
            detail="Internal authentication is not configured",
        )

    if not x_internal_token or not secrets.compare_digest(
        x_internal_token,
        expected_token,
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )
