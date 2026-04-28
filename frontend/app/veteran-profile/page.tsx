"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useRouter as useNav } from "next/navigation";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { api, auth } from "@/lib/api";
import AppHeader from "@/components/AppHeader";

import ContactScreen from "./screens/ContactScreen";
import HomelessScreen from "./screens/HomelessScreen";
import ServiceRecordsScreen from "./screens/ServiceRecordsScreen";
import ExposureScreen from "./screens/ExposureScreen";
import ServicePayScreen from "./screens/ServicePayScreen";

const SCREENS = [
  { id: "contact", label: "Contact" },
  { id: "homeless", label: "Homeless" },
  { id: "service", label: "Service Records" },
  { id: "exposure", label: "Exposure" },
  { id: "service-pay", label: "Service Pay" },
];

function VeteranProfileContent() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    api.getVeteranProfile()
      .then(setProfile)
      .catch(() => setProfile({}))
      .finally(() => setLoading(false));
  }, [router]);

  const save = async (patch: any) => {
    setSaving(true);
    try {
      await api.updateVeteranProfile(patch);
      setProfile((prev: any) => mergeDeep(prev ?? {}, patch));
      if (step < SCREENS.length - 1) {
        setStep((s) => s + 1);
      } else {
        toast.success("Profile saved!");
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const screenProps = { profile, onSave: save, saving, onBack: step > 0 ? () => setStep((s) => s - 1) : undefined };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader maxWidth="max-w-5xl" />

      {/* Page title row with Save & Exit */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Veteran Profile</h2>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Save &amp; Exit
          </button>
        </div>
      </div>

      {/* Step indicator + progress bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 pt-3 pb-2 flex items-center gap-1 overflow-x-auto">
          {SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                i === step
                  ? "bg-brand-600 text-white"
                  : i < step
                  ? "bg-green-100 text-green-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {i < step && <Check className="w-3 h-3" />}
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="max-w-5xl mx-auto px-6 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">
              Step {step + 1} of {SCREENS.length}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(((step + 1) / SCREENS.length) * 100)}% complete
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / SCREENS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Screen */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {step === 0 && <ContactScreen {...screenProps} />}
        {step === 1 && <HomelessScreen {...screenProps} />}
        {step === 2 && <ServiceRecordsScreen {...screenProps} />}
        {step === 3 && <ExposureScreen {...screenProps} />}
        {step === 4 && <ServicePayScreen {...screenProps} />}
      </div>
    </div>
  );
}

function mergeDeep(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default function VeteranProfilePage() {
  return (
    <Suspense>
      <VeteranProfileContent />
    </Suspense>
  );
}
