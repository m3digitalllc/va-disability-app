"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, CheckCircle, Clock } from "lucide-react";
import DropZone from "@/components/documents/DropZone";
import { api } from "@/lib/api";

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDocuments(id)
      .then(setDocs)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

      <DropZone caseId={id} onUploaded={(doc) => setDocs((prev) => [doc, ...prev])} />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
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
                {doc.processed ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                    <CheckCircle className="w-3 h-3" />
                    Processed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full shrink-0">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
