"use client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface ScreenProps {
  profile: any;
  onSave: (patch: any) => void;
  saving: boolean;
  onBack?: () => void;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function FormRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function NavButtons({
  onBack,
  onNext,
  saving,
  isLast,
}: {
  onBack?: () => void;
  onNext: () => void;
  saving: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50 text-sm"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {isLast ? "Save Profile" : "Save & Continue"}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </>
        )}
      </button>
    </div>
  );
}
