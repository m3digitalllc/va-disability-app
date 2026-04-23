import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, Case, Message, User
from app.api.deps import get_current_user
from app.core.encryption import encrypt, decrypt
from app.services.skills_loader import get_interview_conductor_prompt
from app.services.claude_service import stream_chat

router = APIRouter(prefix="/api/cases/{case_id}/chat", tags=["chat"])


class ChatMessage(BaseModel):
    content: str


async def _get_case(case_id: str, user: User, db: AsyncSession) -> Case:
    result = await db.execute(select(Case).where(Case.id == case_id, Case.user_id == user.id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/history")
async def get_history(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)
    result = await db.execute(
        select(Message).where(Message.case_id == case_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {"role": m.role, "content": decrypt(m.content_encrypted), "phase": m.phase}
        for m in messages
    ]


@router.post("/send")
async def send_message(
    case_id: str,
    body: ChatMessage,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = await _get_case(case_id, user, db)

    # Persist user message
    user_msg = Message(
        case_id=case_id,
        role="user",
        content_encrypted=encrypt(body.content),
        phase=case.current_phase,
    )
    db.add(user_msg)
    await db.commit()

    # Load conversation history for Claude
    result = await db.execute(
        select(Message).where(Message.case_id == case_id).order_by(Message.created_at)
    )
    all_messages = result.scalars().all()
    claude_messages = [
        {"role": m.role, "content": decrypt(m.content_encrypted)}
        for m in all_messages
    ]

    system_prompt = get_interview_conductor_prompt()

    # SSE streaming response
    async def event_stream():
        full_response = ""
        async for chunk in stream_chat(system_prompt, claude_messages):
            full_response += chunk
            yield f"data: {json.dumps({'text': chunk})}\n\n"

        # Persist assistant response
        async with db.begin():
            assistant_msg = Message(
                case_id=case_id,
                role="assistant",
                content_encrypted=encrypt(full_response),
                phase=case.current_phase,
            )
            db.add(assistant_msg)

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
