from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, User, VeteranProfile, ServicePay
from app.api.deps import get_current_user
from app.core.audit import log_action
from app.core.encryption import encrypt, decrypt
from app.core.rate_limit import client_ip

router = APIRouter(prefix="/api/veteran-profile", tags=["veteran-profile"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProfileContact(BaseModel):
    va_file_number: Optional[str] = None
    service_number_dod_id: Optional[str] = None
    prior_va_claim: Optional[bool] = None
    phone_number: Optional[str] = None
    address_street: Optional[str] = None
    address_apt: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    address_country: Optional[str] = None
    consent_electronic_correspondence: Optional[bool] = None
    is_va_employee: Optional[bool] = None


class ProfileHomeless(BaseModel):
    currently_homeless: Optional[bool] = None
    homeless_situation: Optional[str] = None
    at_risk_of_homeless: Optional[bool] = None
    at_risk_situation: Optional[str] = None
    homeless_poc_name: Optional[str] = None
    homeless_poc_phone: Optional[str] = None


class ProfileServicePay(BaseModel):
    receiving_retired_pay: Optional[bool] = None
    future_retired_pay: Optional[bool] = None
    retired_pay_branch: Optional[str] = None
    retired_pay_monthly_amount: Optional[str] = None
    retired_status: Optional[str] = None
    waive_va_for_retired_pay: Optional[bool] = None
    separation_pay_received: Optional[bool] = None
    separation_pay_date: Optional[str] = None
    separation_pay_branch: Optional[str] = None
    separation_pay_amount: Optional[str] = None
    waive_va_for_training_pay: Optional[bool] = None


class ProfileUpsertRequest(BaseModel):
    contact: Optional[ProfileContact] = None
    homeless: Optional[ProfileHomeless] = None
    service_records: Optional[list[Any]] = None
    exposure_data: Optional[dict[str, Any]] = None
    claim_program_type: Optional[str] = None
    bdd_anticipated_release_date: Optional[str] = None
    service_pay: Optional[ProfileServicePay] = None


def _enc(val: Optional[str]) -> Optional[str]:
    return encrypt(val) if val else None


def _dec(val: Optional[str]) -> Optional[str]:
    return decrypt(val) if val else None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
async def get_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vp_result = await db.execute(
        select(VeteranProfile).where(VeteranProfile.user_id == current_user.id)
    )
    vp = vp_result.scalar_one_or_none()

    sp_result = await db.execute(
        select(ServicePay).where(ServicePay.user_id == current_user.id)
    )
    sp = sp_result.scalar_one_or_none()

    profile = {
        "contact": {
            "va_file_number": vp.va_file_number if vp else None,
            "service_number_dod_id": vp.service_number_dod_id if vp else None,
            "prior_va_claim": vp.prior_va_claim if vp else None,
            "phone_number": _dec(vp.phone_number_encrypted) if vp else None,
            "address_street": _dec(vp.address_street_encrypted) if vp else None,
            "address_apt": vp.address_apt if vp else None,
            "address_city": vp.address_city if vp else None,
            "address_state": vp.address_state if vp else None,
            "address_zip": vp.address_zip if vp else None,
            "address_country": vp.address_country if vp else None,
            "consent_electronic_correspondence": vp.consent_electronic_correspondence if vp else None,
            "is_va_employee": vp.is_va_employee if vp else None,
        },
        "homeless": {
            "currently_homeless": vp.currently_homeless if vp else None,
            "homeless_situation": vp.homeless_situation if vp else None,
            "at_risk_of_homeless": vp.at_risk_of_homeless if vp else None,
            "at_risk_situation": vp.at_risk_situation if vp else None,
            "homeless_poc_name": _dec(vp.homeless_poc_name_encrypted) if vp else None,
            "homeless_poc_phone": _dec(vp.homeless_poc_phone_encrypted) if vp else None,
        },
        "service_records": vp.service_records if vp else [],
        "exposure_data": vp.exposure_data if vp else {},
        "claim_program_type": vp.claim_program_type if vp else None,
        "bdd_anticipated_release_date": vp.bdd_anticipated_release_date if vp else None,
        "service_pay": {
            "receiving_retired_pay": sp.receiving_retired_pay if sp else None,
            "future_retired_pay": sp.future_retired_pay if sp else None,
            "retired_pay_branch": sp.retired_pay_branch if sp else None,
            "retired_pay_monthly_amount": _dec(sp.retired_pay_monthly_amount_encrypted) if sp else None,
            "retired_status": sp.retired_status if sp else None,
            "waive_va_for_retired_pay": sp.waive_va_for_retired_pay if sp else None,
            "separation_pay_received": sp.separation_pay_received if sp else None,
            "separation_pay_date": sp.separation_pay_date if sp else None,
            "separation_pay_branch": sp.separation_pay_branch if sp else None,
            "separation_pay_amount": _dec(sp.separation_pay_amount_encrypted) if sp else None,
            "waive_va_for_training_pay": sp.waive_va_for_training_pay if sp else None,
        },
    }
    await log_action(
        db, "profile_read", user_id=current_user.id, resource_type="profile",
        resource_id=current_user.id, ip_address=client_ip(request),
    )
    return profile


@router.put("")
async def upsert_profile(
    request: Request,
    body: ProfileUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── VeteranProfile ─────────────────────────────────────────────────────────
    vp_result = await db.execute(
        select(VeteranProfile).where(VeteranProfile.user_id == current_user.id)
    )
    vp = vp_result.scalar_one_or_none()
    if not vp:
        vp = VeteranProfile(user_id=current_user.id)
        db.add(vp)

    if body.contact:
        c = body.contact
        if c.va_file_number is not None:
            vp.va_file_number = c.va_file_number
        if c.service_number_dod_id is not None:
            vp.service_number_dod_id = c.service_number_dod_id
        if c.prior_va_claim is not None:
            vp.prior_va_claim = c.prior_va_claim
        if c.phone_number is not None:
            vp.phone_number_encrypted = _enc(c.phone_number)
        if c.address_street is not None:
            vp.address_street_encrypted = _enc(c.address_street)
        if c.address_apt is not None:
            vp.address_apt = c.address_apt
        if c.address_city is not None:
            vp.address_city = c.address_city
        if c.address_state is not None:
            vp.address_state = c.address_state
        if c.address_zip is not None:
            vp.address_zip = c.address_zip
        if c.address_country is not None:
            vp.address_country = c.address_country
        if c.consent_electronic_correspondence is not None:
            vp.consent_electronic_correspondence = c.consent_electronic_correspondence
        if c.is_va_employee is not None:
            vp.is_va_employee = c.is_va_employee

    if body.homeless:
        h = body.homeless
        if h.currently_homeless is not None:
            vp.currently_homeless = h.currently_homeless
        if h.homeless_situation is not None:
            vp.homeless_situation = h.homeless_situation
        if h.at_risk_of_homeless is not None:
            vp.at_risk_of_homeless = h.at_risk_of_homeless
        if h.at_risk_situation is not None:
            vp.at_risk_situation = h.at_risk_situation
        if h.homeless_poc_name is not None:
            vp.homeless_poc_name_encrypted = _enc(h.homeless_poc_name)
        if h.homeless_poc_phone is not None:
            vp.homeless_poc_phone_encrypted = _enc(h.homeless_poc_phone)

    if body.service_records is not None:
        vp.service_records = body.service_records
    if body.exposure_data is not None:
        vp.exposure_data = body.exposure_data
    if body.claim_program_type is not None:
        vp.claim_program_type = body.claim_program_type
    if body.bdd_anticipated_release_date is not None:
        vp.bdd_anticipated_release_date = body.bdd_anticipated_release_date

    # ── ServicePay ─────────────────────────────────────────────────────────────
    if body.service_pay:
        sp_result = await db.execute(
            select(ServicePay).where(ServicePay.user_id == current_user.id)
        )
        sp = sp_result.scalar_one_or_none()
        if not sp:
            sp = ServicePay(user_id=current_user.id)
            db.add(sp)
        s = body.service_pay
        if s.receiving_retired_pay is not None:
            sp.receiving_retired_pay = s.receiving_retired_pay
        if s.future_retired_pay is not None:
            sp.future_retired_pay = s.future_retired_pay
        if s.retired_pay_branch is not None:
            sp.retired_pay_branch = s.retired_pay_branch
        if s.retired_pay_monthly_amount is not None:
            sp.retired_pay_monthly_amount_encrypted = _enc(s.retired_pay_monthly_amount)
        if s.retired_status is not None:
            sp.retired_status = s.retired_status
        if s.waive_va_for_retired_pay is not None:
            sp.waive_va_for_retired_pay = s.waive_va_for_retired_pay
        if s.separation_pay_received is not None:
            sp.separation_pay_received = s.separation_pay_received
        if s.separation_pay_date is not None:
            sp.separation_pay_date = s.separation_pay_date
        if s.separation_pay_branch is not None:
            sp.separation_pay_branch = s.separation_pay_branch
        if s.separation_pay_amount is not None:
            sp.separation_pay_amount_encrypted = _enc(s.separation_pay_amount)
        if s.waive_va_for_training_pay is not None:
            sp.waive_va_for_training_pay = s.waive_va_for_training_pay

    await db.commit()
    await log_action(
        db, "profile_updated", user_id=current_user.id, resource_type="profile",
        resource_id=current_user.id, ip_address=client_ip(request),
    )
    return {"message": "Profile saved"}
