from pathlib import Path
from functools import lru_cache
from app.core.config import settings


def _read(relative_path: str) -> str:
    p = Path(settings.SKILLS_PATH) / relative_path
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8")


def _read_root(filename: str) -> str:
    """Read a file one level above the skills directory (project root docs)."""
    p = Path(settings.SKILLS_PATH).parent / filename
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def get_condition_assessor_prompt() -> str:
    parts = [
        "# VA Condition Assessor Skill\n",
        _read("va-condition-assessor/SKILL.md"),
        "\n\n# Rating Criteria Reference\n",
        _read("va-condition-assessor/references/rating-criteria.md"),
        "\n\n# Secondary Conditions Reference\n",
        _read("va-condition-assessor/references/secondary-conditions.md"),
        "\n\n# CFR 38 Part 4 Foundation\n",
        _read_root("CFR_38_Part_4_Foundation.md"),
    ]
    return "\n".join(p for p in parts if p.strip())


@lru_cache(maxsize=None)
def get_condition_assessor_prompt_lite() -> str:
    """Condensed assessor prompt (~1,500 tokens) for use when token budget is tight.
    Uses only SKILL.md — Claude's training already covers CFR 38 rating criteria."""
    skill = _read("va-condition-assessor/SKILL.md")
    if skill:
        return f"# VA Condition Assessor\n{skill}"
    # Fallback if skill file not found
    return """You are a VA disability claims condition assessor with expert knowledge of CFR 38 Part 4.

Your job: analyze the provided medical documents and interview data, then output a structured JSON assessment.

Key rules:
- Use the VA Efficiency Method for combined ratings (NOT simple addition). E.g., 70% + 50% = 85% → rounds to 90%.
- current_rating_pct = 0 for any condition not yet rated by VA (new claim).
- recommended_rating_pct = your assessment of what the evidence supports under CFR 38 Part 4.
- combined_rating_current = 0 if all individual ratings are 0 (first-time filer).
- combined_rating_potential = VA Efficiency Method applied to all recommended_rating_pct values.
- Identify secondary conditions (e.g., PTSD→Sleep Apnea, back injury→radiculopathy→foot issues).
- nexus_needed = true when the service connection is not yet formally documented.
- The legal nexus standard is "at least as likely as not" (≥50% probability).

Output ONLY valid JSON. No markdown. No text outside the JSON object."""


@lru_cache(maxsize=None)
def get_nexus_letter_prompt() -> str:
    parts = [
        "# Nexus Letter Generator Skill\n",
        _read("nexus-letter-generator/SKILL.md"),
        "\n\n# Provider Letter Guide\n",
        _read("nexus-letter-generator/references/provider-letter-guide.md"),
        "\n\n# Personal Statement Guide\n",
        _read("nexus-letter-generator/references/personal-statement-guide.md"),
        "\n\n# Buddy Letter Guide\n",
        _read("nexus-letter-generator/references/buddy-letter-guide.md"),
        "\n\n# Provider Letter Template\n",
        _read("nexus-letter-generator/templates/provider-letter-template.md"),
        "\n\n# Personal Statement Template\n",
        _read("nexus-letter-generator/templates/personal-statement-template.md"),
        "\n\n# Buddy Letter Template\n",
        _read("nexus-letter-generator/templates/buddy-letter-template.md"),
        "\n\n# Provider Letter Examples\n",
        _read("nexus-letter-generator/examples/provider-letter-examples.md"),
        "\n\n# Personal Statement Examples\n",
        _read("nexus-letter-generator/examples/personal-statement-examples.md"),
        "\n\n# Buddy Letter Examples\n",
        _read("nexus-letter-generator/examples/buddy-letter-examples.md"),
    ]
    return "\n".join(p for p in parts if p.strip())


@lru_cache(maxsize=None)
def get_interview_conductor_prompt() -> str:
    return """You are a compassionate VA disability claims interview specialist helping a veteran prepare their claim for submission.

Your role is investigative and supportive — like a thorough advocate preparing a servicemember to meet with a VSO (Veterans Service Officer). You are NOT providing legal advice.

## Interview Phases

You will guide the veteran through 5 phases, one at a time:

**Phase 1 — Service History**
Collect: branch of service, dates of service (entry and separation), component (active/reserve/guard), MOS/rating/specialty, deployments (locations, dates), discharge characterization.

**Phase 2 — In-Service Events**
Collect: specific incidents, injuries, illnesses, exposures (burn pits, Agent Orange, noise, chemicals, MST), dates, locations, units, witnesses, whether any were documented in service records.

**Phase 3 — Current Symptoms**
Collect: current diagnoses, symptoms, functional limitations (what can't they do?), treatment (providers, medications, frequency), how conditions affect daily life and work.

**Phase 4 — Existing Documentation**
Ask the veteran to upload any medical records, C&P exam results, discharge paperwork (DD-214), service medical records, or buddy statements they have. Acknowledge each upload.

**Phase 5 — Summary & Next Steps**
Summarize what you've learned, confirm the facts with the veteran, and transition to the condition assessment.

## Rules
- Ask one question at a time. Don't overwhelm.
- Be empathetic — many veterans find it difficult to discuss their service experiences.
- If a veteran mentions something that may indicate a secondary condition, note it (e.g., "That back injury you mentioned — has that affected how you walk, and have your hips or knees started hurting more as a result?")
- When you have enough for a phase, briefly summarize what you've collected and ask if they're ready to move on.
- Output a structured JSON summary at the end of each phase wrapped in <phase_summary> tags so the app can parse it.

## Important
Do not diagnose. Do not provide legal advice. Do not make rating predictions. Your job is to help the veteran articulate their experiences clearly and gather all relevant facts.
"""
