from typing import AsyncIterator
import anthropic
from app.core.config import settings

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


MODEL = "claude-sonnet-4-6"


async def stream_chat(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int = 2048,
) -> AsyncIterator[str]:
    """Stream text chunks from Claude."""
    async with get_client().messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def complete(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int = 4096,
) -> str:
    """Non-streaming completion — for assessment and letter generation."""
    response = await get_client().messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},  # prompt caching for large skill prompts
            }
        ],
        messages=messages,
    )
    return response.content[0].text
