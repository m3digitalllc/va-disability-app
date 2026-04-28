"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FieldTooltip } from "@/components/ui/FieldTooltip";
import { ProfileChatPanel } from "@/components/profile/ProfileChatPanel";
import { ScreenProps, SectionTitle, NavButtons } from "./shared";

const BRANCHES = ["Army", "Navy", "Marine Corps", "Air Force", "Space Force", "Coast Guard"];
const COMPONENTS = ["Active Duty", "Reserve", "National Guard"];

const EMPTY_RECORD = {
  branch: "", component: "", entry_date: "", exit_date: "", place_of_separation: "",
  served_under_other_name: false, other_name: "", combat_zone_post_911: false,
  pow_status: false, pow_confinement_from: "", pow_confinement_to: "",
  reserve_ng: false, reserve_component: "", reserve_from: "", reserve_to: "",
  reserve_unit_name: "", reserve_unit_address: "", reserve_unit_phone: "",
  currently_activated: false, activation_date: "", anticipated_separation_date: "",
  inactive_duty_training_pay: false,
};

export default function ServiceRecordsScreen({ profile, onSave, saving, onBack }: ScreenProps) {
  const existing = profile?.service_records;
  const [records, setRecords] = useState<any[]>(
    Array.isArray(existing) && existing.length > 0 ? existing : [{ ...EMPTY_RECORD }]
  );

  const update = (i: number, key: string, val: any) =>
    setRecords((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const handleFieldUpdates = (updates: Record<string, any>) => {
    if (Array.isArray(updates.service_records)) {
      setRecords(updates.service_records);
    }
  };

  const handleSave = () => onSave({ service_records: records });

  return (
    <div className="flex gap-6 items-start">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <SectionTitle
          title="Service Records"
          subtitle="From VA Form 21-526EZ, Section VI — Military Service History"
        />

        <div className="space-y-6">
          {records.map((r, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-5 bg-white">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-semibold text-gray-700">Period of Service {i + 1}</p>
                {records.length > 1 && (
                  <button type="button" onClick={() => setRecords((p) => p.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Branch of Service<FieldTooltip text="The military branch in which you served during this period." /></label>
                    <select value={r.branch} onChange={(e) => update(i, "branch", e.target.value)} className="input">
                      <option value="">Select…</option>
                      {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Service Component<FieldTooltip text="Whether you served on Active Duty, in the Reserve, or National Guard during this period." /></label>
                    <select value={r.component} onChange={(e) => update(i, "component", e.target.value)} className="input">
                      <option value="">Select…</option>
                      {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Entry Date<FieldTooltip text="The date you entered active duty, reserve, or guard service for this period. Found on your DD-214 or orders." /></label>
                    <input type="month" value={r.entry_date} onChange={(e) => update(i, "entry_date", e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">Exit / Separation Date<FieldTooltip text="The date you separated from service for this period. Found on your DD-214." /></label>
                    <input type="month" value={r.exit_date} onChange={(e) => update(i, "exit_date", e.target.value)} className="input" />
                  </div>
                </div>

                <div>
                  <label className="label">Place of Separation<FieldTooltip text="The military installation or location where you were separated from service (e.g., Fort Campbell, KY)." /></label>
                  <input type="text" value={r.place_of_separation} onChange={(e) => update(i, "place_of_separation", e.target.value)} placeholder="e.g., Fort Campbell, KY" className="input" />
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <CheckRow label="Served under another name" tooltip="Check if you served under a name different from your current legal name (e.g., maiden name, legal name change)." checked={r.served_under_other_name} onChange={(v) => update(i, "served_under_other_name", v)} />
                  {r.served_under_other_name && (
                    <input type="text" className="input ml-6 w-auto" placeholder="Name used during service" value={r.other_name} onChange={(e) => update(i, "other_name", e.target.value)} />
                  )}

                  <CheckRow label="Served in a combat zone after 9/11" tooltip="Check if you served in a designated combat zone after September 11, 2001, such as Afghanistan, Iraq, or other OEF/OIF/OND locations." checked={r.combat_zone_post_911} onChange={(v) => update(i, "combat_zone_post_911", v)} />

                  <CheckRow label="I was a Prisoner of War (POW)" tooltip="Check if you were captured and held as a prisoner of war during military service. Former POWs may qualify for presumptive service connection for certain conditions." checked={r.pow_status} onChange={(v) => update(i, "pow_status", v)} />
                  {r.pow_status && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div><label className="label text-xs">Confinement From</label><input type="month" className="input" value={r.pow_confinement_from} onChange={(e) => update(i, "pow_confinement_from", e.target.value)} /></div>
                      <div><label className="label text-xs">Confinement To</label><input type="month" className="input" value={r.pow_confinement_to} onChange={(e) => update(i, "pow_confinement_to", e.target.value)} /></div>
                    </div>
                  )}

                  <CheckRow label="Reserve / National Guard service during this period" tooltip="Check if you served in the Reserve or National Guard and want to provide your unit information." checked={r.reserve_ng} onChange={(v) => update(i, "reserve_ng", v)} />
                  {r.reserve_ng && (
                    <div className="space-y-3 ml-6">
                      <select value={r.reserve_component} onChange={(e) => update(i, "reserve_component", e.target.value)} className="input">
                        <option value="">Reserve component…</option>
                        {["Army Reserve","Navy Reserve","Marine Corps Reserve","Air Force Reserve","Coast Guard Reserve","Army National Guard","Air National Guard"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label text-xs">Reserve From</label><input type="month" className="input" value={r.reserve_from} onChange={(e) => update(i, "reserve_from", e.target.value)} /></div>
                        <div><label className="label text-xs">Reserve To</label><input type="month" className="input" value={r.reserve_to} onChange={(e) => update(i, "reserve_to", e.target.value)} /></div>
                      </div>
                      <input type="text" className="input" placeholder="Unit name" value={r.reserve_unit_name} onChange={(e) => update(i, "reserve_unit_name", e.target.value)} />
                      <input type="text" className="input" placeholder="Unit address" value={r.reserve_unit_address} onChange={(e) => update(i, "reserve_unit_address", e.target.value)} />
                      <input type="tel" className="input" placeholder="Unit phone" value={r.reserve_unit_phone} onChange={(e) => update(i, "reserve_unit_phone", e.target.value)} />
                    </div>
                  )}

                  <CheckRow label="Currently activated from reserve/guard" tooltip="Check if you are currently on active duty orders from a reserve or guard component." checked={r.currently_activated} onChange={(v) => update(i, "currently_activated", v)} />
                  {r.currently_activated && (
                    <div className="grid grid-cols-2 gap-3 ml-6">
                      <div><label className="label text-xs">Activation Date</label><input type="month" className="input" value={r.activation_date} onChange={(e) => update(i, "activation_date", e.target.value)} /></div>
                      <div><label className="label text-xs">Anticipated Sep. Date</label><input type="month" className="input" value={r.anticipated_separation_date} onChange={(e) => update(i, "anticipated_separation_date", e.target.value)} /></div>
                    </div>
                  )}

                  <CheckRow label="Received inactive duty training pay" tooltip="Check if you received pay for inactive duty training (IDT/drill weekends) during this period." checked={r.inactive_duty_training_pay} onChange={(v) => update(i, "inactive_duty_training_pay", v)} />
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setRecords((p) => [...p, { ...EMPTY_RECORD }])} className="flex items-center gap-2 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition">
            <Plus className="w-4 h-4" />
            Add another period of service
          </button>
        </div>

        <NavButtons onBack={onBack} onNext={handleSave} saving={saving} isLast={false} />
      </div>

      {/* Chat */}
      <div className="w-80 shrink-0">
        <ProfileChatPanel section="service" currentData={{ service_records: records }} onFieldUpdates={handleFieldUpdates} />
      </div>
    </div>
  );
}

function CheckRow({ label, tooltip, checked, onChange }: { label: string; tooltip: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 text-brand-600 rounded" />
      <span className="text-sm text-gray-700 flex items-center gap-0.5">{label}<FieldTooltip text={tooltip} /></span>
    </label>
  );
}
