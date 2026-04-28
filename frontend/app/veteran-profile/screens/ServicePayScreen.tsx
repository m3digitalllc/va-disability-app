"use client";
import { useState } from "react";
import { FieldTooltip } from "@/components/ui/FieldTooltip";
import { ProfileChatPanel } from "@/components/profile/ProfileChatPanel";
import { ScreenProps, FormRow, SectionTitle, NavButtons } from "./shared";

const BRANCHES = ["Army", "Navy", "Marine Corps", "Air Force", "Space Force", "Coast Guard"];

export default function ServicePayScreen({ profile, onSave, saving, onBack }: ScreenProps) {
  const s = profile?.service_pay ?? {};

  const [receivingRetiredPay, setReceivingRetiredPay] = useState<boolean | null>(s.receiving_retired_pay ?? null);
  const [futureRetiredPay, setFutureRetiredPay] = useState<boolean | null>(s.future_retired_pay ?? null);
  const [retiredPayBranch, setRetiredPayBranch] = useState(s.retired_pay_branch ?? "");
  const [retiredPayAmount, setRetiredPayAmount] = useState(s.retired_pay_monthly_amount ?? "");
  const [retiredStatus, setRetiredStatus] = useState(s.retired_status ?? "");
  const [waiveRetiredPay, setWaiveRetiredPay] = useState<boolean | null>(s.waive_va_for_retired_pay ?? null);
  const [separationPayReceived, setSeparationPayReceived] = useState<boolean | null>(s.separation_pay_received ?? null);
  const [separationPayDate, setSeparationPayDate] = useState(s.separation_pay_date ?? "");
  const [separationPayBranch, setSeparationPayBranch] = useState(s.separation_pay_branch ?? "");
  const [separationPayAmount, setSeparationPayAmount] = useState(s.separation_pay_amount ?? "");
  const [waiveTrainingPay, setWaiveTrainingPay] = useState<boolean | null>(s.waive_va_for_training_pay ?? null);

  const handleFieldUpdates = (updates: Record<string, any>) => {
    if (updates.receiving_retired_pay !== undefined) setReceivingRetiredPay(updates.receiving_retired_pay);
    if (updates.future_retired_pay !== undefined) setFutureRetiredPay(updates.future_retired_pay);
    if (updates.retired_pay_branch !== undefined) setRetiredPayBranch(updates.retired_pay_branch ?? "");
    if (updates.retired_pay_monthly_amount !== undefined) setRetiredPayAmount(updates.retired_pay_monthly_amount ?? "");
    if (updates.retired_status !== undefined) setRetiredStatus(updates.retired_status ?? "");
    if (updates.waive_va_for_retired_pay !== undefined) setWaiveRetiredPay(updates.waive_va_for_retired_pay);
    if (updates.separation_pay_received !== undefined) setSeparationPayReceived(updates.separation_pay_received);
    if (updates.separation_pay_date !== undefined) setSeparationPayDate(updates.separation_pay_date ?? "");
    if (updates.separation_pay_branch !== undefined) setSeparationPayBranch(updates.separation_pay_branch ?? "");
    if (updates.separation_pay_amount !== undefined) setSeparationPayAmount(updates.separation_pay_amount ?? "");
    if (updates.waive_va_for_training_pay !== undefined) setWaiveTrainingPay(updates.waive_va_for_training_pay);
  };

  const currentData = {
    receiving_retired_pay: receivingRetiredPay,
    future_retired_pay: futureRetiredPay,
    retired_pay_branch: retiredPayBranch || null,
    retired_pay_monthly_amount: retiredPayAmount || null,
    retired_status: retiredStatus || null,
    waive_va_for_retired_pay: waiveRetiredPay,
    separation_pay_received: separationPayReceived,
    separation_pay_date: separationPayDate || null,
    separation_pay_branch: separationPayBranch || null,
    separation_pay_amount: separationPayAmount || null,
    waive_va_for_training_pay: waiveTrainingPay,
  };

  const handleSave = () => onSave({ service_pay: currentData });

  return (
    <div className="flex gap-6 items-start">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <SectionTitle
          title="Service Pay"
          subtitle="From VA Form 21-526EZ, Section VII — Military Retired Pay & Separation Pay"
        />

        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Military Retired Pay</p>

            <FormRow label={<>Are you receiving military retired pay?<FieldTooltip text="Indicate whether you are currently receiving military retired pay. If you receive VA compensation and military retired pay, you may be required to waive one dollar of retired pay for each dollar of VA compensation received (concurrent receipt rules apply for certain disability ratings)." /></>}>
              <div className="flex gap-4">
                {([true, false] as const).map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="receiving_retired" checked={receivingRetiredPay === v} onChange={() => setReceivingRetiredPay(v)} className="h-4 w-4 text-brand-600" />
                    <span className="text-sm">{v ? "Yes" : "No"}</span>
                  </label>
                ))}
              </div>
            </FormRow>

            {(receivingRetiredPay || futureRetiredPay) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormRow label={<>Branch<FieldTooltip text="The military branch from which you receive or will receive retired pay." /></>}>
                    <select value={retiredPayBranch} onChange={(e) => setRetiredPayBranch(e.target.value)} className="input">
                      <option value="">Select…</option>
                      {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label={<>Monthly amount<FieldTooltip text="Your gross monthly military retired pay before any deductions." /></>}>
                    <input type="text" value={retiredPayAmount} onChange={(e) => setRetiredPayAmount(e.target.value)} placeholder="$0.00" className="input" />
                  </FormRow>
                </div>
                <FormRow label={<>Retired status<FieldTooltip text="Your retirement list status. Temporary Disability Retirement List (TDRL) means your disability rating may change. Permanent Disability Retirement List (PDRL) means it is stable." /></>}>
                  <select value={retiredStatus} onChange={(e) => setRetiredStatus(e.target.value)} className="input">
                    <option value="">Select…</option>
                    <option value="retired_list">Regular Retired List</option>
                    <option value="permanent_disability">Permanent Disability Retirement List (PDRL)</option>
                    <option value="temp_disability">Temporary Disability Retirement List (TDRL)</option>
                  </select>
                </FormRow>
                <FormRow label={<>Waive retired pay in favor of VA compensation?<FieldTooltip text="You may choose to waive military retired pay dollar-for-dollar to receive VA disability compensation, which may be tax-free. Most veterans do NOT need to waive pay under the Concurrent Retirement and Disability Pay (CRDP) program if their combined rating is 50% or higher." /></>}>
                  <div className="flex gap-4">
                    {([true, false] as const).map((v) => (
                      <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="waive_retired" checked={waiveRetiredPay === v} onChange={() => setWaiveRetiredPay(v)} className="h-4 w-4 text-brand-600" />
                        <span className="text-sm">{v ? "Yes" : "No"}</span>
                      </label>
                    ))}
                  </div>
                </FormRow>
              </>
            )}

            <FormRow label={<>Will you receive retired pay in the future?<FieldTooltip text="If you are not yet receiving retired pay but expect to in the future (e.g., you are currently in service or on TDRL), indicate yes." /></>}>
              <div className="flex gap-4">
                {([true, false] as const).map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="future_retired" checked={futureRetiredPay === v} onChange={() => setFutureRetiredPay(v)} className="h-4 w-4 text-brand-600" />
                    <span className="text-sm">{v ? "Yes" : "No"}</span>
                  </label>
                ))}
              </div>
            </FormRow>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Separation / Severance Pay</p>
            <FormRow label={<>Did you receive separation or severance pay?<FieldTooltip text="Separation pay, also called severance pay, is a lump-sum payment some veterans receive upon discharge. If you received this pay, the VA will recoup it from disability compensation until the full amount is offset." /></>}>
              <div className="flex gap-4">
                {([true, false] as const).map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sep_pay" checked={separationPayReceived === v} onChange={() => setSeparationPayReceived(v)} className="h-4 w-4 text-brand-600" />
                    <span className="text-sm">{v ? "Yes" : "No"}</span>
                  </label>
                ))}
              </div>
            </FormRow>
            {separationPayReceived && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <FormRow label={<>Date received<FieldTooltip text="The date you received separation or severance pay." /></>}>
                    <input type="month" value={separationPayDate} onChange={(e) => setSeparationPayDate(e.target.value)} className="input" />
                  </FormRow>
                  <FormRow label={<>Branch<FieldTooltip text="The military branch that paid the separation pay." /></>}>
                    <select value={separationPayBranch} onChange={(e) => setSeparationPayBranch(e.target.value)} className="input">
                      <option value="">Select…</option>
                      {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </FormRow>
                </div>
                <FormRow label={<>Amount received<FieldTooltip text="The gross amount of separation or severance pay you received." /></>}>
                  <input type="text" value={separationPayAmount} onChange={(e) => setSeparationPayAmount(e.target.value)} placeholder="$0.00" className="input" />
                </FormRow>
              </div>
            )}
          </div>

          <FormRow label={<>Waive VA compensation for inactive duty training pay?<FieldTooltip text="Reservists and National Guard members receiving inactive duty training pay may need to waive VA compensation for the days they receive training pay to avoid a debt." /></>}>
            <div className="flex gap-4">
              {([true, false] as const).map((v) => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="waive_training" checked={waiveTrainingPay === v} onChange={() => setWaiveTrainingPay(v)} className="h-4 w-4 text-brand-600" />
                  <span className="text-sm">{v ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </FormRow>
        </div>

        <NavButtons onBack={onBack} onNext={handleSave} saving={saving} isLast={true} />
      </div>

      {/* Chat */}
      <div className="w-80 shrink-0">
        <ProfileChatPanel section="service-pay" currentData={currentData} onFieldUpdates={handleFieldUpdates} />
      </div>
    </div>
  );
}
