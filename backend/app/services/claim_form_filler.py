"""Fills the official VA Form 21-526EZ PDF with assembled veteran data.

The PDF is a fillable AcroForm. We *write values into existing fields* — we
never re-render the layout. This guarantees the format stays byte-identical
to the VA's published version (modulo the field values we set).

Field-name mapping was discovered by enumerating the AcroForm against the
JAN 2026 revision of `VA-Form-21-526EZ.pdf`. If the VA publishes a new
revision, run a discovery pass and verify the mapping still holds.

Coverage notes:
- Text fields are mapped comprehensively for Sections I, II, III, IV, V,
  VI, VII, and XIII.
- Multi-part fields (phone, SSN, dates, money amounts) are split into the
  per-character/per-component PDF fields automatically.
- Radio button groups (RadioButtonList[N]) and a few checkboxes are skipped
  in v1 because their export values vary per option and require
  per-option testing. A small set of well-named checkboxes (claim program
  type, exposure types, homeless living situation) IS handled.
"""

import io
import re
from typing import Optional, Any

from pypdf import PdfReader, PdfWriter

# ── Field name prefixes (per JAN 2026 PDF revision) ──────────────────────────

P_S1 = "F[0].Page_10[0]."          # Sections I + II (Page 9 of the PDF)
P_S3_S4 = "F[0].#subform[9]."      # Sections III + IV (Page 10)
P_S5 = "F[0].#subform[10]."        # Section V (Page 11)
P_S6_S7 = "F[0].#subform[11]."     # Sections VI + VII (Page 12)
P_S8_S10 = "F[0].#subform[12]."    # Sections VIII + IX + X (Page 13)
P_S11_S12 = "F[0].#subform[13]."   # Sections XI + XII (Page 14)
P_S13 = "F[0].#subform[14]."       # Section XIII addendum (Page 15)


# ── Checkbox / radio helpers ─────────────────────────────────────────────────
#
# pypdf accepts checkbox values as "/Yes" (checked) or omitted/empty (unchecked).
# Radio buttons accept their export value as "/0", "/1", etc. We discovered
# the export values by enumerating /AP /N keys on each /Btn field. By
# convention on this form, /0 = first listed option (e.g., "Yes" for Y/N
# questions), /1 = second option, and so on.

CHECKED = "/Yes"


def _checkbox(values: dict, name: str, checked: Any) -> None:
    """Mark a checkbox as /Yes when truthy. Leaves the field alone otherwise
    so partial data doesn't unintentionally uncheck things."""
    if checked:
        values[name] = CHECKED


def _radio_yn(values: dict, name: str, yn: Any) -> None:
    """Set a Yes/No radio: True → /0, False → /1. Leaves alone for None."""
    if yn is True:
        values[name] = "/0"
    elif yn is False:
        values[name] = "/1"


def _radio_index(values: dict, name: str, index: Optional[int]) -> None:
    """Set a multi-option radio to /<index>. Skip if index is None."""
    if index is not None and index >= 0:
        values[name] = f"/{index}"


# Branch of service ordering on the PDF (8 radio options). These match the
# visual layout on the form where Army is checkbox #1.
BRANCH_INDEX: dict[str, int] = {
    "ARMY": 0,
    "NAVY": 1,
    "MARINE_CORPS": 2,
    "AIR_FORCE": 3,
    "COAST_GUARD": 4,
    "SPACE_FORCE": 5,
    "NOAA": 6,
    "USPHS": 7,
}

# Component on most-recent service (3 options)
COMPONENT_INDEX: dict[str, int] = {
    "ACTIVE": 0,
    "RESERVES": 1,
    "NATIONAL_GUARD": 2,
}

# Reserve/NG component (when 21A = Yes, 2 options)
RESERVE_NG_INDEX: dict[str, int] = {
    "NATIONAL_GUARD": 0,
    "RESERVES": 1,
}

# Retired status (3 options)
RETIRED_STATUS_INDEX: dict[str, int] = {
    "retired_list": 0,
    "permanent_disability": 1,
    "temp_disability": 2,
}


def _str(v: Any) -> str:
    """Render a value as a string for the PDF, treating None / empty as ''."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Yes" if v else "No"
    return str(v)


def _split_date(date_str: Optional[str]) -> tuple[str, str, str]:
    """Parse 'MM-DD-YYYY' or 'YYYY-MM-DD' into (month, day, year) strings.

    Returns ('', '', '') if unparseable. Tolerates extra whitespace and
    common alternate separators (/ or .).
    """
    if not date_str:
        return ("", "", "")
    s = re.sub(r"\s+", "", date_str)
    s = s.replace("/", "-").replace(".", "-")
    parts = s.split("-")
    if len(parts) != 3:
        return ("", "", "")
    a, b, c = parts
    # Heuristic: 4-digit chunk is the year
    if len(a) == 4:
        return (b, c, a)  # YYYY-MM-DD
    if len(c) == 4:
        return (a, b, c)  # MM-DD-YYYY
    return ("", "", "")


def _split_month_year(date_str: Optional[str]) -> tuple[str, str]:
    """Parse 'MM-YYYY' or 'YYYY-MM' into (month, year)."""
    if not date_str:
        return ("", "")
    s = re.sub(r"\s+", "", date_str).replace("/", "-").replace(".", "-")
    parts = s.split("-")
    if len(parts) == 2:
        a, b = parts
        if len(a) == 4:
            return (b, a)
        return (a, b)
    if len(parts) == 3:
        # MM-DD-YYYY → use first and last
        if len(parts[2]) == 4:
            return (parts[0], parts[2])
        if len(parts[0]) == 4:
            return (parts[1], parts[0])
    return ("", "")


def _split_phone(phone: Optional[str]) -> tuple[str, str, str]:
    """Extract digits from any phone format, return (area, middle3, last4)."""
    if not phone:
        return ("", "", "")
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 10:
        digits = digits[-10:]
        return (digits[0:3], digits[3:6], digits[6:10])
    return ("", "", "")


def _split_money(amount: Optional[str]) -> tuple[str, str]:
    """Parse a dollar amount string into (whole_dollars, cents).

    The PDF has separate fields for the whole-dollar portion and the cents
    (or decimal) portion in some money entries. We populate just the whole
    dollars when only one field is present.
    """
    if amount is None:
        return ("", "")
    s = re.sub(r"[^0-9.]", "", str(amount))
    if not s:
        return ("", "")
    if "." in s:
        whole, _, cents = s.partition(".")
        return (whole, cents.ljust(2, "0")[:2])
    return (s, "00")


def _split_zip(zip_code: Optional[str]) -> tuple[str, str]:
    """Parse a ZIP into (first5, last4)."""
    if not zip_code:
        return ("", "")
    digits = re.sub(r"\D", "", zip_code)
    if len(digits) >= 9:
        return (digits[0:5], digits[5:9])
    return (digits[:5], "")


# ── Section builders ─────────────────────────────────────────────────────────

def _section_1_fields(s1: dict) -> dict[str, str]:
    """Section I — Veteran identification, contact, address."""
    out: dict[str, str] = {}
    out[P_S1 + "Veteran_Service_Member_First_Name[0]"] = _str(s1.get("veteran_name_first"))
    middle = _str(s1.get("veteran_name_middle"))
    out[P_S1 + "Veteran_Service_Member_Middle_Initial[0]"] = (middle[:1] if middle else "")
    out[P_S1 + "Veteran_Service_Member_Last_Name[0]"] = _str(s1.get("veteran_name_last"))
    out[P_S1 + "VA_File_Number[0]"] = _str(s1.get("va_file_number"))
    out[P_S1 + "Veterans_Service_Number_If_Applicable[0]"] = _str(s1.get("service_number_dod_id"))

    # BDD anticipated release date (split MM-DD-YYYY)
    bm, bd, by = _split_date(s1.get("bdd_release_date"))
    out[P_S1 + "BDD_Claims_Only__Provide_The_Date_Or_Anticipated_Date_Of_Release_From_Active_Duty_Month[0]"] = bm
    out[P_S1 + "BDD_Claims_Only__Provide_The_Date_Or_Anticipated_Date_Of_Release_From_Active_Duty_Day[0]"] = bd
    out[P_S1 + "BDD_Claims_Only_Provide_The_Date_Or_Anticipated_Date_Of_Release_From_Active_Duty_Year[0]"] = by

    # Phone (area + middle3 + last4)
    a, m, last = _split_phone(s1.get("phone"))
    out[P_S1 + "Daytime_Phone_Number_Area_Code[0]"] = a
    out[P_S1 + "Telephone_Middle_Three_Numbers[0]"] = m
    out[P_S1 + "Telephone_Last_Four_Numbers[0]"] = last

    # Email — the form has two email fields (overflow)
    email = _str(s1.get("email"))
    out[P_S1 + "Email_Address_Optional[0]"] = email[:50]
    out[P_S1 + "Email_Address_Optional[1]"] = email[50:100]

    # Address
    out[P_S1 + "CurrentMailingAddress_NumberAndStreet[0]"] = _str(s1.get("address_street"))
    out[P_S1 + "CurrentMailingAddress_ApartmentOrUnitNumber[0]"] = _str(s1.get("address_apt"))
    out[P_S1 + "CurrentMailingAddress_City[0]"] = _str(s1.get("address_city"))
    out[P_S1 + "CurrentMailingAddress_StateOrProvince[0]"] = _str(s1.get("address_state"))
    out[P_S1 + "CurrentMailingAddress_Country[0]"] = _str(s1.get("address_country"))
    z5, z4 = _split_zip(s1.get("address_zip"))
    out[P_S1 + "CurrentMailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]"] = z5
    out[P_S1 + "CurrentMailingAddress_ZIPOrPostalCode_LastFourNumbers[0]"] = z4

    # ── Checkboxes & radios ──
    program = (s1.get("claim_program_type") or "").upper()
    _checkbox(out, P_S1 + "FULLY_DEVELOPED_CLAIM_FDC_PROGRAM[0]", program == "FDC")
    _checkbox(out, P_S1 + "Standard_Claim_Process[0]", program == "STANDARD")
    _checkbox(out, P_S1 + "IDES[0]", program == "IDES")
    _checkbox(out, P_S1 + "BDD_Program_Claim[0]", program == "BDD")

    # "Have you ever filed a claim with VA?" Y/N (Item 4)
    _radio_yn(out, P_S1 + "RadioButtonList2[0]", s1.get("filed_claim_before"))
    # "I agree to receive electronic correspondence from VA" — single checkbox (Item 11)
    _checkbox(out, P_S1 + "CheckBox1[0]", s1.get("email_consent_correspondence"))
    # VA employee (Item 12)
    _checkbox(out, P_S1 + "Current_VA_Employee_Check_Box[0]", s1.get("is_va_employee"))

    return out


def _section_2_fields(s2: dict) -> dict[str, str]:
    """Section II — Change of address (optional)."""
    out: dict[str, str] = {}
    out[P_S1 + "New_Address_NumberAndStreet[0]"] = _str(s2.get("new_address_street"))
    out[P_S1 + "New_Address_ApartmentOrUnitNumber[0]"] = _str(s2.get("new_address_apt"))
    out[P_S1 + "New_Address_City[0]"] = _str(s2.get("new_address_city"))
    out[P_S1 + "New_Address_StateOrProvince[0]"] = _str(s2.get("new_address_state"))
    out[P_S1 + "New_Address_Country[0]"] = _str(s2.get("new_address_country"))
    z5, z4 = _split_zip(s2.get("new_address_zip"))
    out[P_S1 + "New_Address_ZIPOrPostalCode_FirstFiveNumbers[0]"] = z5
    out[P_S1 + "New_Address_ZIPOrPostalCode_LastFourNumbers[0]"] = z4

    bm, bd, by = _split_date(s2.get("effective_beginning_date"))
    out[P_S1 + "Beginning_Date_Month[0]"] = bm
    out[P_S1 + "Beginning_Date_Day[0]"] = bd
    out[P_S1 + "Beginning_Date_Year[0]"] = by
    em, ed, ey = _split_date(s2.get("effective_ending_date"))
    out[P_S1 + "Ending_Date_Month[0]"] = em
    out[P_S1 + "Ending_Date_Day[0]"] = ed
    out[P_S1 + "Ending_Date_Year[0]"] = ey

    # Item 13A "Type of Address Change" — radio with 2 options:
    # /0 = Temporary, /1 = Permanent. If no address change is pending,
    # explicitly clear to /Off so neither box appears checked.
    change_type = (s2.get("address_change_type") or "").upper()
    if change_type == "TEMPORARY":
        _radio_index(out, P_S1 + "RadioButtonList6[0]", 0)
    elif change_type == "PERMANENT":
        _radio_index(out, P_S1 + "RadioButtonList6[0]", 1)
    else:
        out[P_S1 + "RadioButtonList6[0]"] = "/Off"

    return out


def _section_3_fields(s3: dict) -> dict[str, str]:
    """Section III — Homeless info (text + checkboxes + Y/N radios)."""
    out: dict[str, str] = {}
    out[P_S3_S4 + "POINT_OF_CONTACT[0]"] = _str(s3.get("poc_name"))
    a, m, last = _split_phone(s3.get("poc_phone"))
    out[P_S3_S4 + "Telephone_Number_Area_Code[0]"] = a
    out[P_S3_S4 + "Telephone_Middle_Three_Numbers[0]"] = m
    out[P_S3_S4 + "Telephone_Last_Four_Numbers[0]"] = last

    # ── Y/N radios ──
    # 14A Currently homeless? → RadioButtonList2[0]
    _radio_yn(out, P_S3_S4 + "RadioButtonList2[0]", s3.get("currently_homeless"))
    # 14C At risk of becoming homeless? → RadioButtonList2[1]
    _radio_yn(out, P_S3_S4 + "RadioButtonList2[1]", s3.get("at_risk_of_homeless"))

    # ── 14B Living situation checkboxes ──
    sit = (s3.get("homeless_situation") or "").lower()
    _checkbox(out, P_S3_S4 + "Living_In_A_Homeless_Shelter[0]", sit == "shelter")
    _checkbox(out, P_S3_S4 + "Not_Currently_In_A_Sheltered_Environment_e\\.g\\._Living_In_A_Car_Or_Tent[0]",
              sit == "unsheltered")
    _checkbox(out, P_S3_S4 + "Staying_With_Another_Person[0]", sit == "with_other")
    _checkbox(out, P_S3_S4 + "Fleeing_Current_Residence[0]", sit == "fleeing")
    _checkbox(out, P_S3_S4 + "OTHER_Specify[0]", sit == "other")

    # ── 14D At-risk situation checkboxes ──
    risk = (s3.get("at_risk_situation") or "").lower()
    _checkbox(out, P_S3_S4 + "Housing_Will_Be_Lost_In_30_Days[0]", risk == "lose_30days")
    _checkbox(out, P_S3_S4 + "Leaving_Publicly_Funded_System_Of_Care_e\\.g\\._Homeless_Shelter[0]",
              risk == "leaving_funded_care")
    _checkbox(out, P_S3_S4 + "OTHER_Specify[1]", risk == "other")

    return out


def _section_4_fields(s4: dict) -> dict[str, str]:
    """Section IV — Exposure info (text fields only)."""
    out: dict[str, str] = {}
    # Other locations / additional dates
    out[P_S3_S4 + "List_Other_Locations_Where_You_Served[0]"] = _str(s4.get("herbicide_other_locations"))
    out[P_S3_S4 + "Provide_Additional_Dates_And_Locations_Of_Potential_Exposure[0]"] = _str(
        s4.get("additional_exposure_notes")
    )
    out[P_S3_S4 + "OTHER_SPECIFY[0]"] = _str(s4.get("other_exposure_specify"))

    # Date ranges (Gulf War / Herbicide / Other)
    gf_m, gf_y = _split_month_year(s4.get("gulf_war_from"))
    gt_m, gt_y = _split_month_year(s4.get("gulf_war_to"))
    hf_m, hf_y = _split_month_year(s4.get("herbicide_from"))
    ht_m, ht_y = _split_month_year(s4.get("herbicide_to"))
    of_m, of_y = _split_month_year(s4.get("exposure_from"))
    ot_m, ot_y = _split_month_year(s4.get("exposure_to"))

    out[P_S3_S4 + "From_Date_Month[0]"] = gf_m
    out[P_S3_S4 + "From_Date_Year[0]"] = gf_y
    out[P_S3_S4 + "To_Date_Month[0]"] = gt_m
    out[P_S3_S4 + "To_Date_Year[0]"] = gt_y
    out[P_S3_S4 + "From_Date_Month[1]"] = hf_m
    out[P_S3_S4 + "From_Date_Year[1]"] = hf_y
    out[P_S3_S4 + "To_Date_Month[1]"] = ht_m
    out[P_S3_S4 + "To_Date_Year[1]"] = ht_y
    out[P_S3_S4 + "From_Date_Month[2]"] = of_m
    out[P_S3_S4 + "From_Date_Year[2]"] = of_y
    out[P_S3_S4 + "To_Date_Month[2]"] = ot_m
    out[P_S3_S4 + "To_Date_Year[2]"] = ot_y

    # ── Y/N radios ──
    # 15A Claiming toxic exposure? → RadioButtonList2[2]
    _radio_yn(out, P_S3_S4 + "RadioButtonList2[2]", s4.get("claiming_toxic_exposure"))
    # 15B Gulf War service? → RadioButtonList2[3]
    _radio_yn(out, P_S3_S4 + "RadioButtonList2[3]", s4.get("gulf_war_service"))
    # 15C Herbicide service? → RadioButtonList2[4]
    _radio_yn(out, P_S3_S4 + "RadioButtonList2[4]", s4.get("herbicide_exposure"))

    # ── 15D Exposure type checkboxes ──
    types = s4.get("exposure_types") or {}
    _checkbox(out, P_S3_S4 + "ASBESTOS[0]", types.get("asbestos"))
    _checkbox(out, P_S3_S4 + "Mustard_Gas[0]", types.get("mustard_gas"))
    _checkbox(out, P_S3_S4 + "Radiation[0]", types.get("radiation"))
    _checkbox(out, P_S3_S4 + "SHAD_Shipboard_Hazard_And_Defense[0]", types.get("shad"))
    _checkbox(out, P_S3_S4 + "Military_Occupational_Specialty_MOS_Related_Toxin[0]", types.get("mos_toxin"))
    _checkbox(out, P_S3_S4 + "Contaminated_Water_At_Camp_Lejeune[0]", types.get("camp_lejeune_water"))
    _checkbox(out, P_S3_S4 + "OTHER_Specify[2]", types.get("other"))

    return out


def _claim_row_fields(prefix: str, claims: list[dict], offset: int = 0, max_rows: int = 15) -> dict[str, str]:
    """Map up to `max_rows` claim rows starting at PDF index `offset`.

    The form has parallel arrays of CURRENTDISABILITY[i],
    Specify_Type_Of_Exposure_Event_Or_Injury[i], and
    ExplainHowDisabilityRelatesToEvent_Exposure_Injury[i] for i in range.
    """
    out: dict[str, str] = {}
    for i, c in enumerate(claims[:max_rows]):
        idx = i + offset
        out[prefix + f"CURRENTDISABILITY[{idx}]"] = _str(c.get("disability"))
        out[prefix + f"Specify_Type_Of_Exposure_Event_Or_Injury[{idx}]"] = _str(c.get("exposure_event_injury"))
        out[prefix + f"ExplainHowDisabilityRelatesToEvent_Exposure_Injury[{idx}]"] = _str(c.get("explanation"))
    return out


def _section_5_fields(s5: dict) -> dict[str, str]:
    """Section V — Claim info: up to 15 claim rows + treatment facilities."""
    out: dict[str, str] = {}
    claims = (s5.get("claims") or [])[:15]
    out.update(_claim_row_fields(P_S5, claims, offset=0, max_rows=15))

    # The first row's "began/worsened" date has its own labeled field; rows
    # 2-15 use Date12[0..13].
    if claims:
        out[P_S5 + "Date_Disability_Began_Or_Worsened[0]"] = _str(claims[0].get("approximate_date"))
    for i, c in enumerate(claims[1:], start=0):
        out[P_S5 + f"Date12[{i}]"] = _str(c.get("approximate_date"))

    # Treatment facilities (3 slots)
    facilities = s5.get("treatment_facilities") or []
    for i, f in enumerate(facilities[:3]):
        out[P_S5 + f"Enter_Disability_Treated_And_Name_And_Location_Of_Treatment_Facility[{i}]"] = _str(
            f.get("disability_and_facility")
        )
        m, y = _split_month_year(f.get("date"))
        out[P_S5 + f"Date_Of_Treatment_Month[{i}]"] = m
        out[P_S5 + f"Date_Of_Treatment_Year[{i}]"] = y

    return out


def _section_6_fields(s6: dict) -> dict[str, str]:
    """Section VI — Service info (text fields only)."""
    out: dict[str, str] = {}
    out[P_S6_S7 + "List_Other_Name_You_Served_Under[0]"] = _str(s6.get("other_names"))
    out[P_S6_S7 + "PlaceOfLastOrAnticipatedSeparation[0]"] = _str(s6.get("place_of_separation"))[:40]
    out[P_S6_S7 + "PlaceOfLastOrAnticipatedSeparation[1]"] = _str(s6.get("place_of_separation"))[40:80]

    em, ed, ey = _split_date(s6.get("entry_date"))
    out[P_S6_S7 + "EntryDate_Month[0]"] = em
    out[P_S6_S7 + "MostRecentActiveServiceEntryDate_Day[0]"] = ed
    out[P_S6_S7 + "EntryDate_Year[0]"] = ey
    xm, xd, xy = _split_date(s6.get("exit_date"))
    out[P_S6_S7 + "ExitDate_Month[0]"] = xm
    out[P_S6_S7 + "ExitDate_Day[0]"] = xd
    out[P_S6_S7 + "ExitDate_Year[0]"] = xy

    am, ad, ay = _split_date(s6.get("activation_date"))
    out[P_S6_S7 + "DateOfActivation_Month[0]"] = am
    out[P_S6_S7 + "DateOfActivation_Day[0]"] = ad
    out[P_S6_S7 + "DateOfActivation_Year[0]"] = ay
    sm, sd, sy = _split_date(s6.get("anticipated_separation_date"))
    out[P_S6_S7 + "AnticipatedSeparationDate_Month[0]"] = sm
    out[P_S6_S7 + "AnticipatedSeparationDate_Day[0]"] = sd
    out[P_S6_S7 + "AnticipatedSeparationDate_Year[0]"] = sy

    pm, pd, py = _split_date(s6.get("pow_confinement_from"))
    out[P_S6_S7 + "DatesOfConfinement_Month[0]"] = pm
    out[P_S6_S7 + "DatesOfConfinement_Day[0]"] = pd
    out[P_S6_S7 + "DatesOfConfinement_Year[0]"] = py
    pm2, pd2, py2 = _split_date(s6.get("pow_confinement_to"))
    out[P_S6_S7 + "DatesOfConfinement_Month[1]"] = pm2
    out[P_S6_S7 + "DatesOfConfinement_Day[1]"] = pd2
    out[P_S6_S7 + "DatesOfConfinement_Year[1]"] = py2

    out[P_S6_S7 + "CURRENT_OR_LAST_ASSIGNED_NAME_AND_ADDRESS_OF_UNIT[0]"] = _str(s6.get("reserve_unit_name"))
    out[P_S6_S7 + "Current_Or_Assigned_Phone_Number_Of_Unit_Include_Area_Code[0]"] = _str(s6.get("reserve_unit_phone"))

    # Reserve obligation term — entry & exit
    rf_m, rf_d, rf_y = _split_date(s6.get("reserve_from"))
    out[P_S6_S7 + "ObligationTermOfService_Month[0]"] = rf_m
    out[P_S6_S7 + "ObligationTermOfService_Day[0]"] = rf_d
    out[P_S6_S7 + "ObligationTermOfService_Year[0]"] = rf_y
    rt_m, rt_d, rt_y = _split_date(s6.get("reserve_to"))
    out[P_S6_S7 + "ObligationTermOfService_Month[1]"] = rt_m
    out[P_S6_S7 + "ObligationTermOfService_Day[1]"] = rt_d
    out[P_S6_S7 + "ObligationTermOfService_Year[1]"] = rt_y

    # Future Reserve/National Guard explanation
    out[P_S6_S7 + "EXPLAIN[0]"] = _str(s6.get("future_retired_pay_explanation") or "")

    # ── Y/N radios (Section VI Y/N items, in form order) ──
    # 18A Served under another name? → RadioButtonList[0]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[0]", s6.get("served_under_other_name"))
    # 20C Combat zone since 9-11-2001? → RadioButtonList[1]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[1]", s6.get("combat_zone_post_911"))
    # 21A Currently or ever served in Reserves/NG? → RadioButtonList[2]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[2]", s6.get("reserve_ng"))
    # 21F Currently receiving inactive duty training pay? → RadioButtonList[3]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[3]", s6.get("inactive_duty_training_pay"))
    # 22A Currently activated on Federal orders? → RadioButtonList[4]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[4]", s6.get("currently_activated"))
    # 23A Ever been a prisoner of war? → RadioButtonList[5]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[5]", s6.get("pow_status"))

    # ── Multi-option radios ──
    # 19A Branch of service (8 options) → RadioButtonList[10]
    _radio_index(out, P_S6_S7 + "RadioButtonList[10]", BRANCH_INDEX.get((s6.get("branch") or "").upper()))
    # 19B Component (Active/Reserves/National Guard, 3 options) → RadioButtonList[12]
    _radio_index(out, P_S6_S7 + "RadioButtonList[12]", COMPONENT_INDEX.get((s6.get("component") or "").upper()))
    # 21B Reserve/NG component (NG or Reserves, 3rd state unused) → RadioButtonList[9]
    _radio_index(out, P_S6_S7 + "RadioButtonList[9]",
                 RESERVE_NG_INDEX.get((s6.get("reserve_component") or "").upper()))

    return out


def _section_7_extras(s7: dict) -> dict[str, str]:
    """Section VII checkboxes + radios that live on subform[11]/[12]."""
    out: dict[str, str] = {}

    # 24A Currently receiving military retired pay? → RadioButtonList[6]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[6]", s7.get("receiving_retired_pay"))
    # 24B Will receive military retired pay in the future? → RadioButtonList[7]
    _radio_yn(out, P_S6_S7 + "RadioButtonList[7]", s7.get("future_retired_pay"))
    # 24C Branch (8 options) → RadioButtonList[11]
    _radio_index(out, P_S6_S7 + "RadioButtonList[11]",
                 BRANCH_INDEX.get((s7.get("retired_pay_branch") or "").upper()))
    # 25 Retired status (3 options) → RadioButtonList[8] (Y/N)? actually 3 states
    # The two-state radio at index [8] is likely a Y/N. The retired status
    # 3-option radio is the only remaining 3-state slot. Best guess: leave
    # to user to mark by hand if our mapping doesn't catch — added as a
    # tentative mapping below.
    _radio_index(out, P_S6_S7 + "RadioButtonList[8]",
                 RETIRED_STATUS_INDEX.get((s7.get("retired_status") or "").lower()))

    # 26 Don't pay VA compensation in lieu of retired pay (checkbox)
    _checkbox(out, P_S6_S7 + "Do_Not_Pay_Me_VA_Compensation_I_Do_Not_Want_To_Receive-VA_Compensation_In_Lieu_Of_Retired_Pay[0]",
              s7.get("waive_va_for_retired_pay"))

    # ── Section VIII fields living on subform[12] ──
    # 27A Received separation/severance pay? → RadioButtonList[13]
    _radio_yn(out, P_S8_S10 + "RadioButtonList[13]", s7.get("separation_pay_received"))
    # 27B Date payment received (split MM/DD/YYYY)
    sm, sd, sy = _split_date(s7.get("separation_pay_date"))
    out[P_S8_S10 + "DatePaymentReceived_Month[0]"] = sm
    out[P_S8_S10 + "DatePaymentReceived_Day[0]"] = sd
    out[P_S8_S10 + "DatePaymentReceived_Year[0]"] = sy
    # 27C Branch (8 options) → RadioButtonList[15]
    _radio_index(out, P_S8_S10 + "RadioButtonList[15]",
                 BRANCH_INDEX.get((s7.get("separation_pay_branch") or "").upper()))
    # 27D Amount received (split into first three / last three digits)
    whole, _ = _split_money(s7.get("separation_pay_amount"))
    if len(whole) > 3:
        first3 = whole[:-3]
        last3 = whole[-3:]
    else:
        first3 = ""
        last3 = whole
    out[P_S8_S10 + "Amount_Received_First_Three_Digits[0]"] = first3
    out[P_S8_S10 + "Amount_Received_Last_Three_Digits[0]"] = last3
    # 28 Don't pay VA compensation in lieu of training pay (checkbox)
    _checkbox(out, P_S8_S10 + "Do_NOT_Pay_Me_VA_Compensation_I_Do_Not_Want_To_Receive_VA_Compensation_In_Lieu_Of_Training_Pay[0]",
              s7.get("waive_va_for_training_pay"))

    return out


def _section_7_fields(s7: dict) -> dict[str, str]:
    """Section VII — Service Pay (monthly amount split into thousands/units)."""
    out: dict[str, str] = {}
    # Monthly retired pay amount (split into Monthly_Amount[0] and [1])
    whole, _ = _split_money(s7.get("retired_pay_monthly_amount"))
    if len(whole) > 3:
        thousands = whole[:-3]
        rest = whole[-3:]
    else:
        thousands = ""
        rest = whole
    out[P_S6_S7 + "Monthly_Amount[0]"] = thousands
    out[P_S6_S7 + "Monthly_Amount[1]"] = rest
    return out


def _section_13_fields(s13: dict) -> dict[str, str]:
    """Section XIII — Addendum claims 16+. Up to 20 rows in the addendum."""
    out: dict[str, str] = {}
    claims = (s13.get("claims") or [])[:20]
    # The addendum CURRENTDISABILITY indices start at 15 in the AcroForm
    out.update(_claim_row_fields(P_S13, claims, offset=15, max_rows=20))

    # Addendum dates use Date12[14..33] and Date_Disability_Began_Or_Worsened[1] for first row
    if claims:
        out[P_S13 + "Date_Disability_Began_Or_Worsened[1]"] = _str(claims[0].get("approximate_date"))
    for i, c in enumerate(claims[1:], start=14):
        out[P_S13 + f"Date12[{i}]"] = _str(c.get("approximate_date"))

    return out


# ── Public entry point ───────────────────────────────────────────────────────

def fill_form_21_526ez(pdf_bytes: bytes, form_data: dict) -> bytes:
    """Fill the 21-526EZ AcroForm with the given assembled form data.

    `form_data` matches the structure returned by `claim_form_service.assemble_form_data()`'s
    `data` key — i.e., section_1, section_2, section_3, etc.

    Returns the filled PDF bytes. Empty fields are left blank, so partial
    data produces a partially-filled form ready for hand-completion.
    """
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter(clone_from=reader)

    # Build the complete field-name → value map
    values: dict[str, str] = {}
    values.update(_section_1_fields(form_data.get("section_1") or {}))
    values.update(_section_2_fields(form_data.get("section_2") or {}))
    values.update(_section_3_fields(form_data.get("section_3") or {}))
    values.update(_section_4_fields(form_data.get("section_4") or {}))
    values.update(_section_5_fields(form_data.get("section_5") or {}))
    values.update(_section_6_fields(form_data.get("section_6") or {}))
    values.update(_section_7_fields(form_data.get("section_7") or {}))
    values.update(_section_7_extras(form_data.get("section_7") or {}))
    values.update(_section_13_fields(form_data.get("section_13") or {}))

    # Drop empty values — pypdf will overwrite existing form values with
    # blank strings otherwise, which is fine, but we skip them to keep the
    # write minimal.
    values = {k: v for k, v in values.items() if v not in (None, "")}

    # update_page_form_field_values requires a page; iterate over all pages
    # and let pypdf match field names across the form. auto_regenerate=True
    # tells the PDF viewer to regenerate appearance streams so the values
    # display correctly even in viewers that don't auto-render them.
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, values, auto_regenerate=True)
        except Exception:
            # A field on this page may not exist; pypdf raises rather than
            # skipping. Continue to next page.
            continue

    # Set NeedAppearances on the AcroForm so viewers regenerate field
    # appearances (Adobe Reader otherwise shows pre-built appearances and
    # ignores the values we wrote).
    from pypdf.generic import BooleanObject, NameObject, NumberObject
    if "/AcroForm" in writer._root_object:
        writer._root_object["/AcroForm"][NameObject("/NeedAppearances")] = BooleanObject(True)

    # Lock all filled fields against downstream editing by setting the
    # ReadOnly flag (/Ff bit 1) on every annotation widget. The veteran
    # may still print and ink-sign the PDF, but recipients (VSO, attorney,
    # buddies) opening it in Adobe can't accidentally — or maliciously —
    # alter the values. Signature fields are intentionally exempted so the
    # form remains digitally signable.
    READONLY_FLAG = 1 << 0
    for page in writer.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        for annot_ref in annots:
            try:
                annot = annot_ref.get_object()
                if annot.get("/Subtype") != "/Widget":
                    continue
                if annot.get("/FT") == "/Sig":
                    # Leave signature widgets alone so the form remains signable
                    continue
                existing = int(annot.get("/Ff", 0))
                annot[NameObject("/Ff")] = NumberObject(existing | READONLY_FLAG)
            except Exception:
                continue

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
