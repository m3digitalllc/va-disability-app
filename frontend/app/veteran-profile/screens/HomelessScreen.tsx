"use client";
import { useState } from "react";
import { FieldTooltip } from "@/components/ui/FieldTooltip";
import { ProfileChatPanel } from "@/components/profile/ProfileChatPanel";
import { ScreenProps, FormRow, SectionTitle, NavButtons } from "./shared";

export default function HomelessScreen({ profile, onSave, saving, onBack }: ScreenProps) {
  const h = profile?.homeless ?? {};

  const [currentlyHomeless, setCurrentlyHomeless] = useState<boolean | null>(h.currently_homeless ?? null);
  const [homelessSituation, setHomelessSituation] = useState(h.homeless_situation ?? "");
  const [atRisk, setAtRisk] = useState<boolean | null>(h.at_risk_of_homeless ?? null);
  const [atRiskSituation, setAtRiskSituation] = useState(h.at_risk_situation ?? "");
  const [pocName, setPocName] = useState(h.homeless_poc_name ?? "");
  const [pocPhone, setPocPhone] = useState(h.homeless_poc_phone ?? "");

  const handleFieldUpdates = (updates: Record<string, any>) => {
    if (updates.currently_homeless !== undefined) setCurrentlyHomeless(updates.currently_homeless);
    if (updates.homeless_situation !== undefined) setHomelessSituation(updates.homeless_situation ?? "");
    if (updates.at_risk_of_homeless !== undefined) setAtRisk(updates.at_risk_of_homeless);
    if (updates.at_risk_situation !== undefined) setAtRiskSituation(updates.at_risk_situation ?? "");
    if (updates.homeless_poc_name !== undefined) setPocName(updates.homeless_poc_name ?? "");
    if (updates.homeless_poc_phone !== undefined) setPocPhone(updates.homeless_poc_phone ?? "");
  };

  const currentData = {
    currently_homeless: currentlyHomeless,
    homeless_situation: homelessSituation || null,
    at_risk_of_homeless: atRisk,
    at_risk_situation: atRiskSituation || null,
    homeless_poc_name: pocName || null,
    homeless_poc_phone: pocPhone || null,
  };

  const handleSave = () => onSave({ homeless: currentData });

  return (
    <div className="flex gap-6 items-start">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <SectionTitle
          title="Homeless Information"
          subtitle="From VA Form 21-526EZ, Section III — Homeless veterans receive expedited processing"
        />

        <div className="space-y-5">
          <FormRow label={<>Are you currently homeless?<FieldTooltip text="If you are currently without a fixed, adequate nighttime residence, you may qualify for expedited claim processing. Answer honestly — this information helps the VA prioritize your claim." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="homeless" checked={currentlyHomeless === val} onChange={() => setCurrentlyHomeless(val)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm text-gray-700">{val ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>

          {currentlyHomeless && (
            <FormRow label={<>Current living situation<FieldTooltip text="Select the option that best describes where you are currently staying." /></>}>
              <select value={homelessSituation} onChange={(e) => setHomelessSituation(e.target.value)} className="input">
                <option value="">Select situation…</option>
                <option value="shelter">Living in a shelter</option>
                <option value="not_shelter">Not in a shelter (outside, car, etc.)</option>
                <option value="fleeing_domestic_violence">Fleeing domestic violence</option>
                <option value="transitional_housing">Transitional or temporary housing</option>
                <option value="temporarily_with_others">Temporarily staying with others</option>
              </select>
            </FormRow>
          )}

          <FormRow label={<>Are you at risk of becoming homeless?<FieldTooltip text="If you are at imminent risk of losing your housing within 90 days, check yes. This includes situations like eviction, lease expiration, or leaving an institution without housing lined up." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="at_risk" checked={atRisk === val} onChange={() => setAtRisk(val)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm text-gray-700">{val ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>

          {atRisk && (
            <FormRow label={<>At-risk situation<FieldTooltip text="Briefly describe the circumstances that place you at risk of becoming homeless." /></>}>
              <select value={atRiskSituation} onChange={(e) => setAtRiskSituation(e.target.value)} className="input">
                <option value="">Select situation…</option>
                <option value="losing_housing">Losing current housing</option>
                <option value="leaving_institution">Leaving an institution (hospital, jail)</option>
                <option value="other">Other</option>
              </select>
            </FormRow>
          )}

          {(currentlyHomeless || atRisk) && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Point of contact (optional)
                <FieldTooltip text="If you have a case worker, social worker, or other point of contact who can receive VA correspondence on your behalf, provide their information here." />
              </p>
              <div className="space-y-3">
                <input type="text" value={pocName} onChange={(e) => setPocName(e.target.value)} placeholder="Contact name" className="input" />
                <input type="tel" value={pocPhone} onChange={(e) => setPocPhone(e.target.value)} placeholder="Contact phone" className="input" />
              </div>
            </div>
          )}
        </div>

        <NavButtons onBack={onBack} onNext={handleSave} saving={saving} isLast={false} />
      </div>

      {/* Chat */}
      <div className="w-80 shrink-0">
        <ProfileChatPanel section="homeless" currentData={currentData} onFieldUpdates={handleFieldUpdates} />
      </div>
    </div>
  );
}
