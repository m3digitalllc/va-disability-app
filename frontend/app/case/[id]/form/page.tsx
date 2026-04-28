"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  Eye,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Section configuration ─────────────────────────────────────────────────────
//
// Each section declares its fields so the page renders generically. Field
// metadata controls input type, options (for selects), and labels. Adding a
// field here + in the backend service is the only work needed to expose it.

type FieldType = "text" | "textarea" | "boolean" | "select" | "date" | "money";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}

interface SectionDef {
  id: string;          // backend section key, e.g. "section_1"
  formLabel: string;   // displayed as the section title
  formNumber: string;  // "I", "II", etc. for the badge
  description?: string;
  fields: FieldDef[];
}

const YN: FieldDef["options"] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const SECTIONS: SectionDef[] = [
  {
    id: "section_1",
    formNumber: "I",
    formLabel: "Veteran Identification & Contact",
    description: "Name, contact info, and claim program type. SSN and DOB are intentionally not stored — write them on the printed form.",
    fields: [
      {
        key: "claim_program_type",
        label: "Claim Program",
        type: "select",
        options: [
          { value: "FDC", label: "FDC (Fully Developed Claim)" },
          { value: "Standard", label: "Standard Claim Process" },
          { value: "IDES", label: "IDES" },
          { value: "BDD", label: "BDD (90-180 days pre-discharge)" },
        ],
      },
      { key: "veteran_name_first", label: "First Name", type: "text" },
      { key: "veteran_name_middle", label: "Middle Initial", type: "text" },
      { key: "veteran_name_last", label: "Last Name", type: "text" },
      { key: "filed_claim_before", label: "Filed a claim with VA before?", type: "boolean" },
      { key: "va_file_number", label: "VA File Number", type: "text" },
      { key: "service_number_dod_id", label: "Service Number / DoD ID", type: "text" },
      { key: "bdd_release_date", label: "BDD Anticipated Release Date", type: "date", hint: "Only required for BDD claims" },
      { key: "phone", label: "Phone Number", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "email_consent_correspondence", label: "Consent to electronic correspondence", type: "boolean" },
      { key: "address_street", label: "Street Address", type: "text" },
      { key: "address_apt", label: "Apt / Unit", type: "text" },
      { key: "address_city", label: "City", type: "text" },
      { key: "address_state", label: "State / Province", type: "text" },
      { key: "address_zip", label: "ZIP / Postal Code", type: "text" },
      { key: "address_country", label: "Country", type: "text" },
      { key: "is_va_employee", label: "I am currently a VA employee", type: "boolean" },
    ],
  },
  {
    id: "section_2",
    formNumber: "II",
    formLabel: "Change of Address",
    description: "Only fill out if your address is changing. Otherwise leave blank.",
    fields: [
      {
        key: "address_change_type",
        label: "Address change type",
        type: "select",
        options: [
          { value: "TEMPORARY", label: "Temporary" },
          { value: "PERMANENT", label: "Permanent" },
        ],
      },
      { key: "new_address_street", label: "New Street", type: "text" },
      { key: "new_address_apt", label: "New Apt / Unit", type: "text" },
      { key: "new_address_city", label: "New City", type: "text" },
      { key: "new_address_state", label: "New State", type: "text" },
      { key: "new_address_zip", label: "New ZIP", type: "text" },
      { key: "new_address_country", label: "New Country", type: "text" },
      { key: "effective_beginning_date", label: "Effective Beginning Date", type: "date" },
      { key: "effective_ending_date", label: "Ending Date (temporary only)", type: "date" },
    ],
  },
  {
    id: "section_3",
    formNumber: "III",
    formLabel: "Homeless Information",
    description: "Only complete if you're currently homeless or at risk.",
    fields: [
      { key: "currently_homeless", label: "Currently homeless?", type: "boolean" },
      {
        key: "homeless_situation",
        label: "Living situation",
        type: "select",
        options: [
          { value: "shelter", label: "Living in a homeless shelter" },
          { value: "unsheltered", label: "Not in a sheltered environment (car/tent)" },
          { value: "with_other", label: "Staying with another person" },
          { value: "fleeing", label: "Fleeing current residence" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "at_risk_of_homeless", label: "At risk of becoming homeless?", type: "boolean" },
      {
        key: "at_risk_situation",
        label: "At-risk situation",
        type: "select",
        options: [
          { value: "lose_30days", label: "Housing will be lost in 30 days" },
          { value: "leaving_funded_care", label: "Leaving publicly funded system of care" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "poc_name", label: "Point of Contact Name", type: "text" },
      { key: "poc_phone", label: "Point of Contact Phone", type: "text" },
    ],
  },
  {
    id: "section_4",
    formNumber: "IV",
    formLabel: "Exposure Information",
    description: "Toxic exposures (Gulf War, herbicide, Camp Lejeune, etc.) that support presumptive service connection.",
    fields: [
      { key: "claiming_toxic_exposure", label: "Claiming conditions related to toxic exposure?", type: "boolean" },
      { key: "gulf_war_service", label: "Gulf War service", type: "boolean" },
      { key: "gulf_war_locations", label: "Gulf War locations", type: "textarea" },
      { key: "gulf_war_from", label: "Gulf War — from (MM-YYYY)", type: "text" },
      { key: "gulf_war_to", label: "Gulf War — to (MM-YYYY)", type: "text" },
      { key: "herbicide_exposure", label: "Herbicide (Agent Orange) exposure", type: "boolean" },
      { key: "herbicide_locations", label: "Herbicide locations", type: "textarea" },
      { key: "herbicide_from", label: "Herbicide — from (MM-YYYY)", type: "text" },
      { key: "herbicide_to", label: "Herbicide — to (MM-YYYY)", type: "text" },
      { key: "other_exposure_specify", label: "Other exposure (specify)", type: "text" },
      { key: "exposure_from", label: "Other exposure — from", type: "text" },
      { key: "exposure_to", label: "Other exposure — to", type: "text" },
      { key: "additional_exposure_notes", label: "Additional notes / multiple exposures", type: "textarea" },
    ],
  },
  {
    id: "section_6",
    formNumber: "VI",
    formLabel: "Service Information",
    description: "Most recent active period. Earlier service periods are tracked separately as 'Additional periods'.",
    fields: [
      { key: "served_under_other_name", label: "Served under another name?", type: "boolean" },
      { key: "other_names", label: "Other names served under", type: "text" },
      {
        key: "branch",
        label: "Branch of Service",
        type: "select",
        options: [
          { value: "ARMY", label: "Army" },
          { value: "NAVY", label: "Navy" },
          { value: "MARINE_CORPS", label: "Marine Corps" },
          { value: "AIR_FORCE", label: "Air Force" },
          { value: "SPACE_FORCE", label: "Space Force" },
          { value: "COAST_GUARD", label: "Coast Guard" },
          { value: "NOAA", label: "NOAA" },
          { value: "USPHS", label: "USPHS" },
        ],
      },
      {
        key: "component",
        label: "Component",
        type: "select",
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "RESERVES", label: "Reserves" },
          { value: "NATIONAL_GUARD", label: "National Guard" },
        ],
      },
      { key: "entry_date", label: "Entry Date", type: "date" },
      { key: "exit_date", label: "Exit Date", type: "date" },
      { key: "place_of_separation", label: "Place of Separation", type: "text" },
      { key: "combat_zone_post_911", label: "Combat zone since 9-11-2001?", type: "boolean" },
      { key: "currently_activated", label: "Currently activated on Federal orders (NG/Reserve)?", type: "boolean" },
      { key: "activation_date", label: "Date of Activation", type: "date" },
      { key: "anticipated_separation_date", label: "Anticipated Separation Date", type: "date" },
      { key: "pow_status", label: "Prisoner of War?", type: "boolean" },
      { key: "pow_confinement_from", label: "POW Confinement — from", type: "date" },
      { key: "pow_confinement_to", label: "POW Confinement — to", type: "date" },
      { key: "reserve_unit_name", label: "Reserve/NG Unit Name", type: "text" },
      { key: "reserve_unit_address", label: "Reserve/NG Unit Address", type: "textarea" },
      { key: "reserve_unit_phone", label: "Reserve/NG Unit Phone", type: "text" },
      { key: "inactive_duty_training_pay", label: "Currently receiving inactive duty training pay?", type: "boolean" },
    ],
  },
  {
    id: "section_7",
    formNumber: "VII",
    formLabel: "Service Pay",
    description: "Retired pay, separation pay, severance — affects how VA compensation is paid.",
    fields: [
      { key: "receiving_retired_pay", label: "Currently receiving military retired pay?", type: "boolean" },
      { key: "future_retired_pay", label: "Will receive military retired pay in the future?", type: "boolean" },
      {
        key: "retired_pay_branch",
        label: "Retired pay — branch",
        type: "select",
        options: [
          { value: "ARMY", label: "Army" },
          { value: "NAVY", label: "Navy" },
          { value: "MARINE_CORPS", label: "Marine Corps" },
          { value: "AIR_FORCE", label: "Air Force" },
          { value: "SPACE_FORCE", label: "Space Force" },
          { value: "COAST_GUARD", label: "Coast Guard" },
          { value: "NOAA", label: "NOAA" },
          { value: "USPHS", label: "USPHS" },
        ],
      },
      { key: "retired_pay_monthly_amount", label: "Retired pay — monthly amount", type: "money" },
      {
        key: "retired_status",
        label: "Retired Status",
        type: "select",
        options: [
          { value: "retired_list", label: "Retired" },
          { value: "permanent_disability", label: "Permanent Disability Retired List" },
          { value: "temp_disability", label: "Temporary Disability Retired List" },
        ],
      },
      { key: "waive_va_for_retired_pay", label: "Do NOT pay VA compensation in lieu of retired pay", type: "boolean" },
      { key: "separation_pay_received", label: "Received separation/severance pay?", type: "boolean" },
      { key: "separation_pay_date", label: "Separation pay date", type: "date" },
      {
        key: "separation_pay_branch",
        label: "Separation pay — branch",
        type: "select",
        options: [
          { value: "ARMY", label: "Army" },
          { value: "NAVY", label: "Navy" },
          { value: "MARINE_CORPS", label: "Marine Corps" },
          { value: "AIR_FORCE", label: "Air Force" },
          { value: "SPACE_FORCE", label: "Space Force" },
          { value: "COAST_GUARD", label: "Coast Guard" },
          { value: "NOAA", label: "NOAA" },
          { value: "USPHS", label: "USPHS" },
        ],
      },
      { key: "separation_pay_amount", label: "Separation pay — amount (pre-tax)", type: "money" },
      { key: "waive_va_for_training_pay", label: "Do NOT pay VA compensation in lieu of training pay", type: "boolean" },
    ],
  },
  {
    id: "section_8",
    formNumber: "VIII",
    formLabel: "Direct Deposit",
    description: "Banking info is intentionally NOT stored by this app. Fill this section in by hand on the printed PDF.",
    fields: [],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEmpty(v: any): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function setNested(obj: any, path: string[], value: any): any {
  const out = { ...obj };
  let cursor = out;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cursor[k] = { ...(cursor[k] ?? {}) };
    cursor = cursor[k];
  }
  cursor[path[path.length - 1]] = value;
  return out;
}

function getNested(obj: any, path: string[]): any {
  let cursor = obj;
  for (const k of path) {
    if (cursor == null) return undefined;
    cursor = cursor[k];
  }
  return cursor;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaseFormPage() {
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<any>(null);
  const [overrides, setOverrides] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    section_1: true,
    section_5: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCaseForm(id);
      setFormData(res);
      setOverrides(res.overrides || {});
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load form");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (sectionId: string, fieldKey: string, value: any) => {
    const newOverrides = setNested(overrides, [sectionId, fieldKey], value);
    setOverrides(newOverrides);
    // Reflect immediately in the displayed data
    setFormData((prev: any) => ({
      ...prev,
      data: setNested(prev.data, [sectionId, fieldKey], value),
    }));
    setDirty(true);
  };

  const updateClaims = (sectionId: "section_5" | "section_13", claims: any[]) => {
    const newOverrides = setNested(overrides, [sectionId, "claims"], claims);
    setOverrides(newOverrides);
    setFormData((prev: any) => ({
      ...prev,
      data: setNested(prev.data, [sectionId, "claims"], claims),
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.saveCaseForm(id, overrides);
      setFormData(res);
      setOverrides(res.overrides || {});
      setDirty(false);
      toast.success("Form saved");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (dirty) {
      toast.error("Save your changes before downloading");
      return;
    }
    setDownloading(true);
    try {
      await api.downloadFilledForm(id);
      toast.success("Form downloaded");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    if (dirty) {
      toast.error("Save your changes before previewing");
      return;
    }
    setPreviewLoading(true);
    try {
      const blob = await api.fetchFilledFormBlob(id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const completion = formData.completion || { percent: 0, filled: 0, total: 0 };

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">VA Form 21-526EZ</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auto-populated from your profile, interview, and document review. Edit any field
            below; changes are saved to your case.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400">Completion</p>
            <p className="text-sm font-semibold text-gray-700">
              {completion.percent}% · {completion.filled}/{completion.total} fields
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
          <button
            onClick={handlePreview}
            disabled={previewLoading || dirty}
            title={dirty ? "Save your changes first" : "Preview filled PDF"}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {previewLoading ? "Loading…" : "Preview"}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || dirty}
            title={dirty ? "Save your changes first" : "Download filled PDF"}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">Filled Form Preview</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review the filled VA Form 21-526EZ. Empty fields will need to be completed by hand or by editing the form data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleDownload();
                  }}
                  disabled={downloading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe
              src={`${previewUrl}#view=FitH`}
              title="Filled VA Form 21-526EZ Preview"
              className="flex-1 w-full bg-gray-100"
            />
          </div>
        </div>
      )}

      {/* Completion bar */}
      <div className="mb-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${completion.percent}%` }}
        />
      </div>

      <div className="space-y-3">
        {/* Sections I, II, III, IV */}
        {SECTIONS.slice(0, 4).map((s) => (
          <SectionAccordion
            key={s.id}
            section={s}
            data={formData.data[s.id] || {}}
            auto={formData.auto[s.id] || {}}
            overridesForSection={overrides[s.id] || {}}
            isOpen={!!openSections[s.id]}
            onToggle={() => setOpenSections((p) => ({ ...p, [s.id]: !p[s.id] }))}
            onChange={(key, val) => updateField(s.id, key, val)}
          />
        ))}

        {/* Section V — Claim Information (special: editable claims list) */}
        <ClaimsSection
          formNumber="V"
          title="Claim Information"
          description="Conditions identified by the assessment + medical record review. Up to 15 fit on Section V; overflow goes to the Addendum (Section XIII)."
          claims={formData.data.section_5?.claims || []}
          autoClaims={formData.auto.section_5?.claims || []}
          isOpen={!!openSections.section_5}
          onToggle={() => setOpenSections((p) => ({ ...p, section_5: !p.section_5 }))}
          onChange={(claims) => updateClaims("section_5", claims)}
        />

        {/* Sections VI, VII, VIII */}
        {SECTIONS.slice(4).map((s) => (
          <SectionAccordion
            key={s.id}
            section={s}
            data={formData.data[s.id] || {}}
            auto={formData.auto[s.id] || {}}
            overridesForSection={overrides[s.id] || {}}
            isOpen={!!openSections[s.id]}
            onToggle={() => setOpenSections((p) => ({ ...p, [s.id]: !p[s.id] }))}
            onChange={(key, val) => updateField(s.id, key, val)}
          />
        ))}

        {/* Section XIII — Addendum (overflow claims 16+) */}
        <ClaimsSection
          formNumber="XIII"
          title="Claim Information Addendum"
          description="Conditions 16 through 35. Only shown when there are more than 15 claimed conditions."
          claims={formData.data.section_13?.claims || []}
          autoClaims={formData.auto.section_13?.claims || []}
          isOpen={!!openSections.section_13}
          onToggle={() => setOpenSections((p) => ({ ...p, section_13: !p.section_13 }))}
          onChange={(claims) => updateClaims("section_13", claims)}
        />
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Sections IX–XII (signatures, witnesses, alternate signer, POA) are signed in pen on the
        printed PDF and are not stored here.
      </p>
    </div>
  );
}

// ── Generic section accordion (atomic fields) ─────────────────────────────────

function SectionAccordion({
  section,
  data,
  auto,
  overridesForSection,
  isOpen,
  onToggle,
  onChange,
}: {
  section: SectionDef;
  data: any;
  auto: any;
  overridesForSection: any;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (key: string, value: any) => void;
}) {
  const filledCount = section.fields.filter((f) => !isEmpty(data[f.key])).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded shrink-0">
            §{section.formNumber}
          </span>
          <span className="font-semibold text-gray-900 truncate">{section.formLabel}</span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {filledCount}/{section.fields.length} filled
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {section.description && (
            <p className="text-xs text-gray-500 mt-2">{section.description}</p>
          )}
          {section.fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No editable fields in this section.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  field={f}
                  value={data[f.key]}
                  autoValue={auto[f.key]}
                  isOverridden={Object.prototype.hasOwnProperty.call(overridesForSection, f.key)}
                  onChange={(v) => onChange(f.key, v)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single field editor ───────────────────────────────────────────────────────

function FieldEditor({
  field,
  value,
  autoValue,
  isOverridden,
  onChange,
}: {
  field: FieldDef;
  value: any;
  autoValue: any;
  isOverridden: boolean;
  onChange: (v: any) => void;
}) {
  const sourceBadge = (() => {
    if (isOverridden) return { text: "Edited", cls: "bg-blue-50 text-blue-600" };
    if (!isEmpty(autoValue)) return { text: "Auto", cls: "bg-green-50 text-green-600" };
    return null;
  })();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-medium text-gray-600">{field.label}</label>
        {sourceBadge && (
          <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${sourceBadge.cls}`}>
            {sourceBadge.text}
          </span>
        )}
      </div>
      {field.type === "boolean" ? (
        <select
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : v === "true");
          }}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">—</option>
          {YN!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "select" ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">—</option>
          {field.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.placeholder}
          rows={2}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-y"
        />
      ) : field.type === "money" ? (
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="0.00"
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      ) : field.type === "date" ? (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="MM-DD-YYYY"
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      ) : (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={field.placeholder}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      )}
      {field.hint && <p className="text-[10px] text-gray-400 mt-0.5">{field.hint}</p>}
    </div>
  );
}

// ── Section V / XIII — Editable claims list ───────────────────────────────────

interface ClaimRow {
  disability: string;
  exposure_event_injury: string | null;
  explanation: string;
  approximate_date: string | null;
  _dc_code?: string;
  _icd10?: string;
  _type?: string;
  _nexus_needed?: boolean;
}

function ClaimsSection({
  formNumber,
  title,
  description,
  claims,
  autoClaims,
  isOpen,
  onToggle,
  onChange,
}: {
  formNumber: string;
  title: string;
  description: string;
  claims: ClaimRow[];
  autoClaims: ClaimRow[];
  isOpen: boolean;
  onToggle: () => void;
  onChange: (claims: ClaimRow[]) => void;
}) {
  const addClaim = () => {
    onChange([
      ...claims,
      {
        disability: "",
        exposure_event_injury: "",
        explanation: "",
        approximate_date: "",
      },
    ]);
  };

  const updateClaim = (index: number, patch: Partial<ClaimRow>) => {
    const next = claims.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange(next);
  };

  const removeClaim = (index: number) => {
    onChange(claims.filter((_, i) => i !== index));
  };

  // A claim row is "auto" if it matches the auto-populated row at the same
  // index. Once edited, it's flagged "Edited" in the UI.
  const isAutoRow = (index: number, row: ClaimRow) => {
    const a = autoClaims[index];
    if (!a) return false;
    return (
      a.disability === row.disability &&
      a.exposure_event_injury === row.exposure_event_injury &&
      a.explanation === row.explanation &&
      a.approximate_date === row.approximate_date
    );
  };

  // Hide Section XIII unless there are claims to show
  if (formNumber === "XIII" && claims.length === 0 && autoClaims.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded shrink-0">
            §{formNumber}
          </span>
          <span className="font-semibold text-gray-900 truncate">{title}</span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {claims.length} {claims.length === 1 ? "condition" : "conditions"}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <p className="text-xs text-gray-500 mt-2">{description}</p>

          {claims.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              No claimed conditions yet. Add one manually, or run the assessment to auto-populate.
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((c, i) => {
                const isAuto = isAutoRow(i, c);
                const badge = isAuto
                  ? { text: "From Assessment", cls: "bg-green-50 text-green-700" }
                  : { text: "Edited", cls: "bg-blue-50 text-blue-700" };
                return (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>
                          {badge.text}
                        </span>
                        {c._dc_code && (
                          <span className="text-[10px] text-gray-500 font-mono">DC {c._dc_code}</span>
                        )}
                        {c._type && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            {c._type}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeClaim(i)}
                        className="text-gray-300 hover:text-red-500 transition"
                        title="Remove condition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Current Disability
                        </label>
                        <input
                          type="text"
                          value={c.disability ?? ""}
                          onChange={(e) => updateClaim(i, { disability: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Approximate Date Began / Worsened
                        </label>
                        <input
                          type="text"
                          value={c.approximate_date ?? ""}
                          onChange={(e) => updateClaim(i, { approximate_date: e.target.value })}
                          placeholder="e.g. 2008 or MM-YYYY"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Exposure / Event / Injury (if applicable)
                        </label>
                        <input
                          type="text"
                          value={c.exposure_event_injury ?? ""}
                          onChange={(e) => updateClaim(i, { exposure_event_injury: e.target.value })}
                          placeholder="e.g. Agent Orange, combat injury, MOS exposure"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          How does this condition relate to your service?
                        </label>
                        <textarea
                          value={c.explanation ?? ""}
                          onChange={(e) => updateClaim(i, { explanation: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white resize-y"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={addClaim}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition"
          >
            <Plus className="w-4 h-4" />
            Add Condition
          </button>
        </div>
      )}
    </div>
  );
}
