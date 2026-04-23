"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, FileText, ChevronRight, Shield, LogOut, Trash2 } from "lucide-react";
import { api, auth } from "@/lib/api";

const PHASE_LABELS = ["", "Service History", "In-Service Events", "Current Symptoms", "Documents", "Assessment"];

export default function DashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    api
      .listCases()
      .then(setCases)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const newCase = await api.createCase("My VA Claim");
      router.push(`/case/${newCase.id}/interview`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this case? This cannot be undone.")) return;
    try {
      await api.deleteCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
      toast.success("Case deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    router.replace("/auth/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-brand-700">
            <Shield className="w-5 h-5" />
            VA Claims Assistant
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
            <p className="text-gray-500 text-sm mt-1">
              Each claim is a separate preparation session for a VA disability claim.
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating…" : "New Claim"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-600 font-medium mb-1">No claims yet</h3>
            <p className="text-gray-400 text-sm mb-4">
              Start a new claim to begin your interview and document upload.
            </p>
            <button
              onClick={handleCreate}
              className="px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
            >
              Start First Claim
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/case/${c.id}/interview`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition">
                      {c.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        Phase {c.current_phase}/5 — {PHASE_LABELS[c.current_phase]}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === "complete"
                            ? "bg-green-100 text-green-700"
                            : c.status === "in_progress"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="p-2 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      title="Delete case"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
