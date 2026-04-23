"use client";
import { useParams } from "next/navigation";
import StreamingChat from "@/components/chat/StreamingChat";
import { InfoIcon } from "lucide-react";

const PHASES = [
  "Service History",
  "In-Service Events",
  "Current Symptoms",
  "Documentation",
  "Assessment & Letters",
];

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();

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
        {PHASES.map((phase, i) => (
          <div
            key={phase}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap shrink-0"
          >
            <span className="w-4 h-4 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-bold">
              {i + 1}
            </span>
            {phase}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <StreamingChat caseId={id} />
      </div>

      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <InfoIcon className="w-3 h-3" />
        This is not legal advice. Use this tool to organize information before meeting with a VSO.
      </p>
    </div>
  );
}
