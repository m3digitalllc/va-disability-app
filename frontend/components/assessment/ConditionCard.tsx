"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface Condition {
  name: string;
  dc_code?: string;
  icd10?: string;
  evidence?: string;
  current_rating_pct?: number;
  rating_basis?: string;
  pathway_to_higher?: string;
  dbq_form?: string;
  type?: string;
  nexus_needed?: boolean;
}

interface Props {
  condition: Condition;
  onGenerateLetter?: (condition: Condition) => void;
}

export default function ConditionCard({ condition, onGenerateLetter }: Props) {
  const [expanded, setExpanded] = useState(false);

  const ratingColor =
    (condition.current_rating_pct ?? 0) >= 70
      ? "bg-green-100 text-green-700"
      : (condition.current_rating_pct ?? 0) >= 30
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{condition.name}</span>
            {condition.dc_code && (
              <span className="text-xs text-gray-400 font-mono">DC {condition.dc_code}</span>
            )}
            {condition.type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium capitalize">
                {condition.type}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {condition.nexus_needed && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
              Nexus needed
            </span>
          )}
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${ratingColor}`}>
            {condition.current_rating_pct ?? 0}%
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3 text-sm">
          {condition.evidence && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Supporting Evidence
              </p>
              <p className="text-gray-700">{condition.evidence}</p>
            </div>
          )}

          {condition.rating_basis && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Rating Basis
              </p>
              <p className="text-gray-700">{condition.rating_basis}</p>
            </div>
          )}

          {condition.pathway_to_higher && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                Pathway to Higher Rating
              </p>
              <p className="text-blue-800">{condition.pathway_to_higher}</p>
            </div>
          )}

          {condition.dbq_form && (
            <p className="text-xs text-gray-400">
              DBQ Form: <span className="font-medium text-gray-600">{condition.dbq_form}</span>
            </p>
          )}

          {condition.nexus_needed && onGenerateLetter && (
            <button
              onClick={() => onGenerateLetter(condition)}
              className="w-full mt-2 py-2 px-4 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition"
            >
              Generate Nexus Letter for This Condition
            </button>
          )}
        </div>
      )}
    </div>
  );
}
