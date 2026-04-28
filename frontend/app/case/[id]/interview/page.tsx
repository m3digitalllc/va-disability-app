"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StreamingChat from "@/components/chat/StreamingChat";
import { CheckCircle2, InfoIcon } from "lucide-react";
import { api } from "@/lib/api";

const PHASES = [
  "Service History",
  "In-Service Events",
  "Current Symptoms",
  "Documentation",
  "Assessment & Letters",
];

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [currentPhase, setCurrentPhase] = useState(1);

  useEffect(() => {
    api.getCase(id).then((c) => setCurrentPhase(c.current_phase)).catch(() => {});
  }, [id]);

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Interview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your AI claims specialist will guide you through 5 phases to build your claim.
        </p>
      </div>

      {/* Phase indicator */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PHASES.map((phase, i) => {
          const phaseNum = i + 1;
          const isComplete = phaseNum < currentPhase;
          const isActive = phaseNum === currentPhase;
          return (
            <div
              key={phase}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                  : isComplete
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? "bg-brand-500 text-white" : "bg-gray-300 text-gray-500"
                  }`}
                >
                  {phaseNum}
                </span>
              )}
              {phase}
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0">
        <StreamingChat caseId={id} onPhaseChange={setCurrentPhase} />
      </div>

      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <InfoIcon className="w-3 h-3" />
        This is not legal advice. Use this tool to organize information before meeting with a VSO.
      </p>
    </div>
  );
}
