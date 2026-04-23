from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.database import get_db, Case, User
from app.api.deps import get_current_user
from app.core.encryption import encrypt, decrypt

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CaseCreate(BaseModel):
    title: str = "My Claim"


class CaseResponse(BaseModel):
    id: str
    title: str
    status: str
    current_phase: int
    created_at: str
    updated_at: str


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Case).where(Case.user_id == user.id).order_by(Case.updated_at.desc()))
    cases = result.scalars().all()
    return [
        CaseResponse(
            id=c.id,
            title=c.title,
            status=c.status,
            current_phase=c.current_phase,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in cases
    ]


@router.post("", status_code=201, response_model=CaseResponse)
async def create_case(
    body: CaseCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    case = Case(user_id=user.id, title=body.title)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return CaseResponse(
        id=case.id,
        title=case.title,
        status=case.status,
        current_phase=case.current_phase,
        created_at=case.created_at.isoformat(),
        updated_at=case.updated_at.isoformat(),
    )


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Case).where(Case.id == case_id, Case.user_id == user.id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return CaseResponse(
        id=case.id,
        title=case.title,
        status=case.status,
        current_phase=case.current_phase,
        created_at=case.created_at.isoformat(),
        updated_at=case.updated_at.isoformat(),
    )


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Case).where(Case.id == case_id, Case.user_id == user.id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    await db.delete(case)
    await db.commit()
