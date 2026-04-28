"use client";
import { useState } from "react";
import { FieldTooltip } from "@/components/ui/FieldTooltip";
import { ProfileChatPanel } from "@/components/profile/ProfileChatPanel";
import { ScreenProps, FormRow, SectionTitle, NavButtons } from "./shared";

export default function ContactScreen({ profile, onSave, saving, onBack }: ScreenProps) {
  const c = profile?.contact ?? {};

  const [vaFileNumber, setVaFileNumber] = useState(c.va_file_number ?? "");
  const [serviceNumber, setServiceNumber] = useState(c.service_number_dod_id ?? "");
  const [priorClaim, setPriorClaim] = useState<boolean | null>(c.prior_va_claim ?? null);
  const [phone, setPhone] = useState(c.phone_number ?? "");
  const [street, setStreet] = useState(c.address_street ?? "");
  const [apt, setApt] = useState(c.address_apt ?? "");
  const [city, setCity] = useState(c.address_city ?? "");
  const [state, setState] = useState(c.address_state ?? "");
  const [zip, setZip] = useState(c.address_zip ?? "");
  const [country, setCountry] = useState(c.address_country ?? "USA");
  const [consent, setConsent] = useState<boolean | null>(c.consent_electronic_correspondence ?? null);
  const [isVaEmployee, setIsVaEmployee] = useState<boolean | null>(c.is_va_employee ?? null);

  const handleFieldUpdates = (updates: Record<string, any>) => {
    if (updates.va_file_number !== undefined) setVaFileNumber(updates.va_file_number ?? "");
    if (updates.service_number_dod_id !== undefined) setServiceNumber(updates.service_number_dod_id ?? "");
    if (updates.prior_va_claim !== undefined) setPriorClaim(updates.prior_va_claim);
    if (updates.phone_number !== undefined) setPhone(updates.phone_number ?? "");
    if (updates.address_street !== undefined) setStreet(updates.address_street ?? "");
    if (updates.address_apt !== undefined) setApt(updates.address_apt ?? "");
    if (updates.address_city !== undefined) setCity(updates.address_city ?? "");
    if (updates.address_state !== undefined) setState(updates.address_state ?? "");
    if (updates.address_zip !== undefined) setZip(updates.address_zip ?? "");
    if (updates.address_country !== undefined) setCountry(updates.address_country ?? "USA");
    if (updates.consent_electronic_correspondence !== undefined) setConsent(updates.consent_electronic_correspondence);
    if (updates.is_va_employee !== undefined) setIsVaEmployee(updates.is_va_employee);
  };

  const currentData = {
    va_file_number: vaFileNumber || null,
    service_number_dod_id: serviceNumber || null,
    prior_va_claim: priorClaim,
    phone_number: phone || null,
    address_street: street || null,
    address_apt: apt || null,
    address_city: city || null,
    address_state: state || null,
    address_zip: zip || null,
    address_country: country || null,
    consent_electronic_correspondence: consent,
    is_va_employee: isVaEmployee,
  };

  const handleSave = () => onSave({ contact: currentData });

  return (
    <div className="flex gap-6 items-start">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <SectionTitle
          title="Contact Information"
          subtitle="From VA Form 21-526EZ, Section I — Identification & Contact"
        />

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormRow label={<>VA File Number<FieldTooltip text="Your VA file number if you have previously filed a claim with the VA. This is different from your Social Security Number. Leave blank if this is your first claim." /></>}>
              <input type="text" value={vaFileNumber} onChange={(e) => setVaFileNumber(e.target.value)} placeholder="Optional" className="input" />
            </FormRow>
            <FormRow label={<>Service Number / DoD ID<FieldTooltip text="Your military service number or Department of Defense Identification Number (DoD ID), found on your military ID card." /></>}>
              <input type="text" value={serviceNumber} onChange={(e) => setServiceNumber(e.target.value)} placeholder="Optional" className="input" />
            </FormRow>
          </div>

          <FormRow label={<>Have you filed a VA claim before?<FieldTooltip text="Indicate whether you have previously filed a claim for compensation or pension with the VA." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="prior_claim" checked={priorClaim === val} onChange={() => setPriorClaim(val)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm text-gray-700">{val ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>

          <FormRow label={<>Phone Number<FieldTooltip text="Your primary daytime phone number including area code. The VA may use this to contact you about your claim." /></>}>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" className="input" />
          </FormRow>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Mailing Address
              <FieldTooltip text="Your current mailing address where VA correspondence will be sent. P.O. Boxes are acceptable." />
            </p>
            <div className="space-y-3">
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" className="input" />
              <input type="text" value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Apt, Suite, Unit (optional)" className="input" />
              <div className="grid grid-cols-3 gap-3">
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="input" />
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" maxLength={2} className="input uppercase" />
                <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" className="input" />
              </div>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="input" />
            </div>
          </div>

          <FormRow label={<>Consent to electronic correspondence?<FieldTooltip text="If yes, the VA may send benefit-related information to you via email in addition to postal mail." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="consent" checked={consent === val} onChange={() => setConsent(val)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm text-gray-700">{val ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>

          <FormRow label={<>Are you a VA employee?<FieldTooltip text="Check yes if you are currently employed by the Department of Veterans Affairs. This determines which VA regional office handles your claim." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="va_employee" checked={isVaEmployee === val} onChange={() => setIsVaEmployee(val)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm text-gray-700">{val ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>
        </div>

        <NavButtons onBack={onBack} onNext={handleSave} saving={saving} isLast={false} />
      </div>

      {/* Chat */}
      <div className="w-80 shrink-0">
        <ProfileChatPanel section="contact" currentData={currentData} onFieldUpdates={handleFieldUpdates} />
      </div>
    </div>
  );
}
