"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, CheckCircle, Clock, Bot, Loader2, Sparkles } from "lucide-react";
import DropZone from "@/components/documents/DropZone";
import { api } from "@/lib/api";

const REVIEW_STATUS_LABELS: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  unreviewed: {
    label: "Not reviewed",
    className: "text-gray-500 bg-gray-50",
    icon: <Bot className="w-3 h-3" />,
  },
  reviewing: {
    label: "Reviewing…",
    className: "text-blue-600 bg-blue-50",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  reviewed: {
    label: "Reviewed",
    className: "text-purple-600 bg-purple-50",
    icon: <Sparkles className="w-3 h-3" />,
  },
  failed: {
    label: "Review failed",
    className: "text-red-500 bg-red-50",
    icon: <Bot className="w-3 h-3" />,
  },
};

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocs = () =>
    api.listDocuments(id).then(setDocs).catch((err) => toast.error(err.message));

  useEffect(() => {
    loadDocs().finally(() => setLoading(false));
  }, [id]);

  // Poll every 15 s while any doc is in "reviewing" state
  useEffect(() => {
    const anyReviewing = docs.some((d) => d.review_status === "reviewing");
    if (anyReviewing && !pollRef.current) {
      pollRef.current = setInterval(loadDocs, 15_000);
    }
    if (!anyReviewing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [docs]);

  const handleReview = async (docId: string) => {
    setReviewing((prev) => ({ ...prev, [docId]: true }));
    try {
      await api.reviewDocument(id, docId);
      toast.success("Document review started — this runs in the background and may take a few minutes.");
      // Optimistically update status to "reviewing" so the pill changes immediately
      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, review_status: "reviewing" } : d))
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReviewing((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Remove this document?")) return;
    try {
      await api.deleteDocument(id, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Medical Documents</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload your medical records, C&amp;P exams, DD-214, and any other relevant documents.
        Files are encrypted and stored securely.
      </p>

      <DropZone caseId={id} onUploaded={(doc) => setDocs((prev) => [{ ...doc, review_status: "unreviewed" }, ...prev])} />

      {/* Document Review explainer */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Document Review Agent
        </p>
        <p className="text-blue-600">
          Large medical records can contain hundreds of pages. The review agent reads your full
          document in sections, extracts every clinically significant finding, and produces a
          compact summary used by the assessment. Run it once — the result is cached.
        </p>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const rs = REVIEW_STATUS_LABELS[doc.review_status] ?? REVIEW_STATUS_LABELS.unreviewed;
              const canReview = doc.processed && doc.review_status !== "reviewing";
              const isStarting = reviewing[doc.id];

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg group"
                >
                  <FileText className="w-5 h-5 text-brand-500 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.original_filename}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Processed badge */}
                  {doc.processed ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle className="w-3 h-3" />
                      Extracted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full shrink-0">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}

                  {/* Review status badge */}
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 ${rs.className}`}>
                    {rs.icon}
                    {rs.label}
                  </span>

                  {/* Review action */}
                  {canReview && (
                    <button
                      onClick={() => handleReview(doc.id)}
                      disabled={isStarting}
                      className="text-xs px-2.5 py-1 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {isStarting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      {doc.review_status === "reviewed" ? "Re-review" : "Review"}
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
