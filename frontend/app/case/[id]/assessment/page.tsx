"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import ConditionCard from "@/components/assessment/ConditionCard";
import { api } from "@/lib/api";

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api
      .getAssessment(id)
      .then(setAssessment)
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [id]);

  const runAssessment = async () => {
    setRunning(true);
    try {
      const result = await api.runAssessment(id);
      setAssessment(result);
      toast.success("Assessment complete");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleGenerateLetter = (condition: any) => {
    router.push(`/case/${id}/letters?condition=${encodeURIComponent(condition.name)}&dc=${condition.dc_code ?? ""}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Condition Assessment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Based on your uploaded medical records analyzed against CFR 38 Part 4.
          </p>
        </div>
        <button
          onClick={runAssessment}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {assessment ? "Re-run Assessment" : "Run Assessment"}
        </button>
      </div>

      {!assessment && !running && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Upload medical documents first, then run the assessment.
          </p>
        </div>
      )}

      {running && (
        <div className="text-center py-16 bg-blue-50 rounded-2xl border border-blue-100">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-brand-700 font-medium">Analyzing your medical records…</p>
          <p className="text-brand-500 text-sm mt-1">This may take 30–60 seconds</p>
        </div>
      )}

      {assessment && !running && (
        <div className="space-y-6">
          {/* Summary ratings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Combined Rating</p>
              <p className="text-3xl font-bold text-gray-900">{assessment.combined_rating_current ?? 0}%</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Potential Combined Rating</p>
              <p className="text-3xl font-bold text-brand-700">{assessment.combined_rating_potential ?? 0}%</p>
              <p className="text-xs text-blue-400 mt-1">with all evidence</p>
            </div>
          </div>

          {/* Priority actions */}
          {assessment.priority_actions?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Priority Actions
              </h3>
              <ol className="space-y-2">
                {assessment.priority_actions.map((action: any, i: number) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-amber-900 font-medium">{action.action}</p>
                      {action.expected_impact && (
                        <p className="text-amber-600 text-xs">{action.expected_impact}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Conditions */}
          {assessment.conditions?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Identified Conditions ({assessment.conditions.length})
              </h3>
              <div className="space-y-2">
                {assessment.conditions.map((cond: any, i: number) => (
                  <ConditionCard
                    key={i}
                    condition={cond}
                    onGenerateLetter={handleGenerateLetter}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Secondary opportunities */}
          {assessment.secondary_opportunities?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Secondary Condition Opportunities</h3>
              <div className="space-y-2">
                {assessment.secondary_opportunities.map((opp: any, i: number) => (
                  <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm">
                    <p className="font-medium text-purple-900">{opp.condition}</p>
                    <p className="text-purple-600 text-xs mt-1">Caused by: {opp.caused_by}</p>
                    <p className="text-purple-500 text-xs">Next step: {opp.next_step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            This assessment is for preparation purposes only and does not guarantee a VA rating.
            Rating determinations are made by the VA.
          </p>
        </div>
      )}
    </div>
  );
}
