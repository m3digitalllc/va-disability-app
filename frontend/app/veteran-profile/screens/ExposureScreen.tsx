"use client";
import { useState } from "react";
import { FieldTooltip } from "@/components/ui/FieldTooltip";
import { ProfileChatPanel } from "@/components/profile/ProfileChatPanel";
import { ScreenProps, SectionTitle, NavButtons } from "./shared";

type Toggle = boolean | null;

function BoolRow({ label, tooltip, value, name, onChange }: {
  label: React.ReactNode; tooltip: string; value: Toggle; name: string; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700 flex items-center gap-0.5">
        {label}<FieldTooltip text={tooltip} />
      </span>
      <div className="flex gap-3 shrink-0">
        {([true, false] as const).map((v) => (
          <label key={String(v)} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="h-3.5 w-3.5 text-brand-600" />
            <span className="text-xs text-gray-600">{v ? "Yes" : "No"}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ExposureScreen({ profile, onSave, saving, onBack }: ScreenProps) {
  const e = profile?.exposure_data ?? {};

  const [data, setData] = useState<Record<string, any>>({
    toxic_exposure_claimed: e.toxic_exposure_claimed ?? null,
    gulf_war_service: e.gulf_war_service ?? null,
    gulf_war_locations: e.gulf_war_locations ?? "",
    gulf_war_from: e.gulf_war_from ?? "",
    gulf_war_to: e.gulf_war_to ?? "",
    herbicide_exposure: e.herbicide_exposure ?? null,
    herbicide_locations: e.herbicide_locations ?? "",
    herbicide_other_locations: e.herbicide_other_locations ?? "",
    herbicide_from: e.herbicide_from ?? "",
    herbicide_to: e.herbicide_to ?? "",
    asbestos: e.asbestos ?? null,
    mustard_gas: e.mustard_gas ?? null,
    radiation: e.radiation ?? null,
    shad: e.shad ?? null,
    mos_toxin: e.mos_toxin ?? null,
    camp_lejeune_water: e.camp_lejeune_water ?? null,
    other_exposure: e.other_exposure ?? null,
    exposure_from: e.exposure_from ?? "",
    exposure_to: e.exposure_to ?? "",
    additional_exposure_notes: e.additional_exposure_notes ?? "",
  });

  const set = (key: string, val: any) => setData((d) => ({ ...d, [key]: val }));

  const handleFieldUpdates = (updates: Record<string, any>) => {
    setData((d) => ({ ...d, ...updates }));
  };

  const handleSave = () => onSave({ exposure_data: data });

  return (
    <div className="flex gap-6 items-start">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <SectionTitle
          title="Exposure Information"
          subtitle="From VA Form 21-526EZ, Section IV — Toxic/Environmental Exposures"
        />

        <div className="space-y-6">
          <BoolRow
            label="Claiming toxic exposure"
            tooltip="Check yes if you believe your disability is related to a toxic substance, environmental hazard, or occupational exposure during military service."
            value={data.toxic_exposure_claimed} name="toxic_exposure_claimed" onChange={(v) => set("toxic_exposure_claimed", v)}
          />

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <BoolRow label="Gulf War / Southwest Asia service" tooltip="Service in the Southwest Asia theater of operations after August 2, 1990, including Iraq, Kuwait, Saudi Arabia, and surrounding areas. Veterans with qualifying service may receive presumptive service connection for certain undiagnosed illnesses." value={data.gulf_war_service} name="gulf_war_service" onChange={(v) => set("gulf_war_service", v)} />
            {data.gulf_war_service && (
              <div className="space-y-2 pt-1">
                <input className="input" placeholder="Locations served (e.g., Kuwait, Iraq)" value={data.gulf_war_locations} onChange={(e) => set("gulf_war_locations", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="month" value={data.gulf_war_from} onChange={(e) => set("gulf_war_from", e.target.value)} />
                  <input className="input" type="month" value={data.gulf_war_to} onChange={(e) => set("gulf_war_to", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <BoolRow label="Herbicide exposure (Agent Orange)" tooltip="Exposure to Agent Orange or other herbicides during service, typically in Vietnam, Korea (DMZ), or other qualifying locations. Veterans with qualifying exposure receive presumptive service connection for many cancers and other conditions." value={data.herbicide_exposure} name="herbicide_exposure" onChange={(v) => set("herbicide_exposure", v)} />
            {data.herbicide_exposure && (
              <div className="space-y-2 pt-1">
                <input className="input" placeholder="Herbicide exposure locations" value={data.herbicide_locations} onChange={(e) => set("herbicide_locations", e.target.value)} />
                <input className="input" placeholder="Other locations (if applicable)" value={data.herbicide_other_locations} onChange={(e) => set("herbicide_other_locations", e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" type="month" value={data.herbicide_from} onChange={(e) => set("herbicide_from", e.target.value)} />
                  <input className="input" type="month" value={data.herbicide_to} onChange={(e) => set("herbicide_to", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 divide-y divide-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Other Hazardous Exposures</p>
            <BoolRow label="Asbestos" tooltip="Exposure to asbestos during military service, common in shipyards, old barracks, and certain MOS assignments (boiler rooms, insulation work)." value={data.asbestos} name="asbestos" onChange={(v) => set("asbestos", v)} />
            <BoolRow label="Mustard gas or Lewisite" tooltip="Participation in chemical weapons testing or exposure to mustard gas or Lewisite during military service." value={data.mustard_gas} name="mustard_gas" onChange={(v) => set("mustard_gas", v)} />
            <BoolRow label="Ionizing radiation" tooltip="Exposure to radiation during atmospheric nuclear testing, post-WWII occupation of Hiroshima or Nagasaki, or other radiation risk activities." value={data.radiation} name="radiation" onChange={(v) => set("radiation", v)} />
            <BoolRow label="Project SHAD / shipboard hazard" tooltip="Participation in Project SHAD (Shipboard Hazard and Defense) testing or exposure to hazardous materials during shipboard operations." value={data.shad} name="shad" onChange={(v) => set("shad", v)} />
            <BoolRow label="MOS/occupational toxin exposure" tooltip="Exposure to toxic materials related to your military occupational specialty (MOS), such as solvents, fuels, heavy metals, or industrial chemicals." value={data.mos_toxin} name="mos_toxin" onChange={(v) => set("mos_toxin", v)} />
            <BoolRow label="Camp Lejeune contaminated water (1953–1987)" tooltip="Service at Marine Corps Base Camp Lejeune, North Carolina between August 1, 1953 and December 31, 1987. Veterans and family members exposed to contaminated drinking water may receive presumptive service connection for certain conditions." value={data.camp_lejeune_water} name="camp_lejeune_water" onChange={(v) => set("camp_lejeune_water", v)} />
            <BoolRow label="Other hazardous exposure" tooltip="Any other occupational, environmental, or toxic exposure not listed above that occurred during military service." value={data.other_exposure} name="other_exposure" onChange={(v) => set("other_exposure", v)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Additional notes</label>
            <textarea rows={3} className="input resize-none" placeholder="Describe any other exposure details not captured above…" value={data.additional_exposure_notes} onChange={(e) => set("additional_exposure_notes", e.target.value)} />
          </div>
        </div>

        <NavButtons onBack={onBack} onNext={handleSave} saving={saving} isLast={false} />
      </div>

      {/* Chat */}
      <div className="w-80 shrink-0">
        <ProfileChatPanel section="exposure" currentData={data} onFieldUpdates={handleFieldUpdates} />
      </div>
    </div>
  );
}
