"""
Document Review Agent
Processes large medical records by chunking them and extracting clinically
significant information via Claude. Returns a compact structured summary
suitable for use in condition assessments.
"""
import asyncio
import json
import logging
import re

from app.services.claude_service import complete

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

CHUNK_CHARS = 14_000       # ~3,500 tokens per chunk
MAX_CHUNKS = 12            # max chunks to process (balances coverage vs time)
CHUNK_DELAY_SECONDS = 12   # delay between chunks to stay under rate limit
MERGE_MAX_TOKENS = 2048    # output budget for the merge pass

EXTRACTION_SYSTEM = """You are a military medical record analyst reviewing VA health records.

Extract ONLY clinically significant information relevant to VA disability claims.
Focus on: diagnoses, chronic conditions, surgeries/procedures, hospitalizations,
specialist consultations, physical profiles, line-of-duty (LOD) determinations,
medications indicating chronic conditions, imaging/lab findings supporting
musculoskeletal or neurological conditions, and documented functional limitations.

Omit: routine refills, normal lab results, administrative headers, immunizations,
dental cleanings, and entries with no clinical significance to a disability claim.

Output ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "conditions": [
    {"name": "...", "icd_or_description": "...", "first_noted": "...", "status": "active|resolved|chronic"}
  ],
  "procedures_surgeries": [
    {"type": "...", "date": "...", "provider": "...", "outcome": "..."}
  ],
  "medications": [
    {"name": "...", "indication": "...", "start_date": "..."}
  ],
  "profiles_lod": [
    {"type": "profile|LOD|MEB", "date": "...", "restriction_or_finding": "..."}
  ],
  "key_findings": "1-3 sentence plain-English summary of the most claim-relevant findings in this section"
}"""

MERGE_SYSTEM = """You are a VA disability claims medical analyst.
You will receive multiple JSON extracts from different sections of the same veteran's
medical record. Merge them into a single comprehensive summary, deduplicating
entries and resolving any conflicts by preferring the most recent or most detailed entry.

Output ONLY valid JSON:
{
  "conditions": [
    {
      "name": "...",
      "icd_or_description": "...",
      "first_noted": "...",
      "most_recent_note": "...",
      "status": "active|resolved|chronic",
      "claim_relevance": "high|medium|low"
    }
  ],
  "procedures_surgeries": [
    {"type": "...", "date": "...", "provider": "...", "outcome": "..."}
  ],
  "medications": [
    {"name": "...", "indication": "...", "start_date": "..."}
  ],
  "profiles_lod": [
    {"type": "profile|LOD|MEB", "date": "...", "restriction_or_finding": "..."}
  ],
  "executive_summary": "3-5 sentence plain-English summary of the most important claim-relevant findings across all sections"
}"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sample_chunks(text: str) -> list[str]:
    """Return up to MAX_CHUNKS evenly-distributed chunks from the document."""
    total = len(text)
    if total <= CHUNK_CHARS:
        return [text]

    # Always include the start (problem list / demographics) and end (most recent)
    positions = []
    if MAX_CHUNKS >= 2:
        positions.append(0)
        positions.append(max(0, total - CHUNK_CHARS))

    # Fill remaining slots evenly across the middle
    remaining = MAX_CHUNKS - 2
    if remaining > 0 and total > CHUNK_CHARS * 2:
        step = (total - CHUNK_CHARS * 2) // (remaining + 1)
        for i in range(1, remaining + 1):
            positions.append(CHUNK_CHARS + step * i)

    positions = sorted(set(positions))
    chunks = []
    for pos in positions:
        end = min(pos + CHUNK_CHARS, total)
        chunks.append(text[pos:end])
    return chunks


def _extract_json(text: str) -> dict:
    """Robustly extract first JSON object from Claude's response."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    if start == -1:
        return {}
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    break
    return {}


# ── Core agent ────────────────────────────────────────────────────────────────

async def _extract_chunk(chunk: str, chunk_num: int, total_chunks: int) -> dict:
    """Run the extraction agent on a single chunk."""
    message = (
        f"This is section {chunk_num} of {total_chunks} from a veteran's combined military "
        f"medical record. Extract all clinically significant findings.\n\n"
        f"--- BEGIN RECORD SECTION ---\n{chunk}\n--- END RECORD SECTION ---"
    )
    try:
        result = await complete(EXTRACTION_SYSTEM, [{"role": "user", "content": message}], max_tokens=1024)
        return _extract_json(result)
    except Exception as e:
        logger.warning("Chunk %d extraction failed: %s", chunk_num, e)
        return {}


async def _merge_chunk_results(extracts: list[dict], doc_name: str) -> dict:
    """Run a merge pass over all chunk extracts to produce the final summary."""
    combined = json.dumps(extracts, indent=2)
    message = (
        f"Document: {doc_name}\n\n"
        f"The following are extraction results from {len(extracts)} sections of the same "
        f"medical record. Merge them into a single deduplicated summary:\n\n{combined}"
    )
    try:
        result = await complete(MERGE_SYSTEM, [{"role": "user", "content": message}], max_tokens=MERGE_MAX_TOKENS)
        merged = _extract_json(result)
        if merged:
            return merged
    except Exception as e:
        logger.warning("Merge pass failed: %s", e)

    # Fallback: concatenate raw extracts if merge fails
    return {"raw_extracts": extracts, "executive_summary": "Merge failed — raw extracts preserved."}


async def review_document(doc_text: str, doc_name: str) -> str:
    """
    Main entry point. Processes a full document through the review agent.

    Returns a JSON string containing the structured medical summary.
    Designed to run once and have its result cached in the database.
    """
    chunks = _sample_chunks(doc_text)
    total = len(chunks)
    logger.info("Document review started: %s | %d chars | %d chunks", doc_name, len(doc_text), total)

    extracts = []
    for i, chunk in enumerate(chunks):
        logger.info("Processing chunk %d/%d", i + 1, total)
        extract = await _extract_chunk(chunk, i + 1, total)
        if extract:
            extracts.append(extract)
        # Rate-limit buffer between chunks (skip delay after last chunk)
        if i < total - 1:
            await asyncio.sleep(CHUNK_DELAY_SECONDS)

    if not extracts:
        return json.dumps({"error": "No content extracted", "executive_summary": "Document review produced no results."})

    logger.info("Merging %d chunk extracts for %s", len(extracts), doc_name)
    merged = await _merge_chunk_results(extracts, doc_name)
    merged["_meta"] = {
        "doc_name": doc_name,
        "total_chars": len(doc_text),
        "chunks_processed": len(extracts),
        "chunks_sampled": total,
    }
    return json.dumps(merged)
