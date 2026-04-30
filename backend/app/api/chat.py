import json
import logging
import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, async_session_factory, Case, Message, User
from app.api.deps import get_current_user
from app.core.audit import log_action
from app.core.encryption import encrypt, decrypt
from app.core.rate_limit import limiter, client_ip
from app.services.skills_loader import get_interview_conductor_prompt
from app.services.claude_service import stream_chat

logger = logging.getLogger(__name__)

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
    request: Request,
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_case(case_id, user, db)
    result = await db.execute(
        select(Message).where(Message.case_id == case_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    await log_action(
        db, "chat_history_read", user_id=user.id, resource_type="case",
        resource_id=case_id, ip_address=client_ip(request),
    )
    return [
        {"role": m.role, "content": decrypt(m.content_encrypted), "phase": m.phase}
        for m in messages
    ]


@router.post("/send")
@limiter.limit("30/minute")
async def send_message(
    request: Request,
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

    # Capture IP before the closure so the audit log can record it after
    # the streamed response finishes (the Request object isn't safe to use
    # from inside the generator).
    request_ip = client_ip(request)

    # SSE streaming response
    async def event_stream():
        full_response = ""
        try:
            async for chunk in stream_chat(system_prompt, claude_messages):
                full_response += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except anthropic.RateLimitError:
            yield f"data: {json.dumps({'error': 'Rate limit reached — please wait a moment and try again.'})}\n\n"
            return
        except anthropic.APIError as e:
            logger.exception("Anthropic API error in chat stream")
            yield f"data: {json.dumps({'error': 'The AI service is temporarily unavailable. Please try again.'})}\n\n"
            return
        except Exception:
            logger.exception("Unexpected error in chat stream")
            yield f"data: {json.dumps({'error': 'An unexpected error occurred. Please try again.'})}\n\n"
            return

        # Persist assistant response and advance phase when Claude emits a summary.
        # Audit log uses its own session — the request-scoped db may be in an
        # ambiguous state inside the generator (FastAPI may have already
        # released it by the time the stream completes).
        async with db.begin():
            assistant_msg = Message(
                case_id=case_id,
                role="assistant",
                content_encrypted=encrypt(full_response),
                phase=case.current_phase,
            )
            db.add(assistant_msg)
            if "<phase_summary>" in full_response and case.current_phase < 5:
                case.current_phase += 1

        async with async_session_factory() as audit_db:
            await log_action(
                audit_db, "chat_message_sent", user_id=user.id,
                resource_type="case", resource_id=case_id, ip_address=request_ip,
            )

        yield f"data: {json.dumps({'done': True, 'current_phase': case.current_phase})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
