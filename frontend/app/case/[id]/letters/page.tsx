"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, ChevronDown, ChevronRight, Download, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const LETTER_TYPES = [
  { value: "provider", label: "Provider / Medical Nexus Letter" },
  { value: "personal", label: "Personal Statement (Veteran)" },
  { value: "buddy", label: "Buddy / Lay Witness Letter" },
];

function LettersContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const prefillCondition = searchParams.get("condition") ?? "";
  const prefillDC = searchParams.get("dc") ?? "";

  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(!!prefillCondition);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    condition_name: prefillCondition,
    dc_code: prefillDC,
    letter_type: "provider",
    service_event: "",
    author_info: "",
    additional_context: "",
  });

  useEffect(() => {
    api
      .listLetters(id)
      .then(setLetters)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const letter = await api.generateLetter(id, form);
      setLetters((prev) => [letter, ...prev]);
      setShowForm(false);
      setExpandedId(letter.id);
      toast.success("Nexus letter generated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadLetter = (letter: any) => {
    const blob = new Blob([letter.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${letter.letter_type}-letter-${letter.condition_name.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nexus Letters</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate provider letters, personal statements, and buddy letters.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Letter
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleGenerate}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4"
        >
          <h3 className="font-semibold text-gray-900">Generate a Nexus Letter</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condition Name *</label>
              <input
                required
                value={form.condition_name}
                onChange={(e) => setForm({ ...form, condition_name: e.target.value })}
                placeholder="e.g., Lumbar Degenerative Disc Disease"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Letter Type *</label>
              <select
                value={form.letter_type}
                onChange={(e) => setForm({ ...form, letter_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {LETTER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              In-Service Event (date, location, what happened)
            </label>
            <textarea
              rows={3}
              value={form.service_event}
              onChange={(e) => setForm({ ...form, service_event: e.target.value })}
              placeholder="e.g., September 2003, during convoy operations in Iraq, was in vehicle when IED exploded nearby..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Author Info (credentials, relationship, contact)
            </label>
            <input
              value={form.author_info}
              onChange={(e) => setForm({ ...form, author_info: e.target.value })}
              placeholder="e.g., Dr. Jane Smith, MD, Orthopedic Surgeon | OR: John Doe, served together in 1/7 Infantry 2003-2004"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Additional Context</label>
            <textarea
              rows={2}
              value={form.additional_context}
              onChange={(e) => setForm({ ...form, additional_context: e.target.value })}
              placeholder="Any denial reasons, existing evidence, or special circumstances..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50 text-sm"
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              {generating ? "Generating…" : "Generate Letter"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : letters.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-sm">
            No letters generated yet. Run the assessment first to identify which conditions need nexus letters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <div key={letter.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === letter.id ? null : letter.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
              >
                {expandedId === letter.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{letter.condition_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{letter.letter_type} letter</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadLetter(letter); }}
                  className="p-2 text-gray-400 hover:text-brand-600 transition"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </button>

              {expandedId === letter.id && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {letter.content}
                  </div>

                  {letter.advisory_notes && (
                    <div className="space-y-3">
                      {letter.advisory_notes.strengths?.length > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                          <ul className="list-disc list-inside space-y-1">
                            {letter.advisory_notes.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-green-800">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {letter.advisory_notes.vulnerabilities?.length > 0 && (
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Potential Vulnerabilities
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            {letter.advisory_notes.vulnerabilities.map((v: string, i: number) => (
                              <li key={i} className="text-xs text-orange-800">{v}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {letter.advisory_notes.strategic_notes && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Strategic Notes</p>
                          <p className="text-xs text-blue-800">{letter.advisory_notes.strategic_notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LettersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>}>
      <LettersContent />
    </Suspense>
  );
}
