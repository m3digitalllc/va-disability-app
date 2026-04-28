"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, ShieldCheck, AlertTriangle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, auth } from "@/lib/api";
import AppHeader from "@/components/AppHeader";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    api.me()
      .then(setProfile)
      .catch(() => toast.error("Failed to load account info"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader maxWidth="max-w-2xl" />

      <div className="max-w-2xl mx-auto px-6 pt-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to claims
        </Link>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-4 pb-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

        {/* Profile Information */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Profile</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <InfoRow
              icon={<User className="w-4 h-4 text-gray-400" />}
              label="Name"
              value={
                profile
                  ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—"
                  : "—"
              }
            />
            <InfoRow
              icon={<Mail className="w-4 h-4 text-gray-400" />}
              label="Email"
              value={profile?.email ?? "—"}
            />
            <InfoRow
              icon={<ShieldCheck className="w-4 h-4 text-gray-400" />}
              label="Two-Factor Authentication"
              value="Enabled"
              valueClass="text-green-600 font-medium"
            />
          </div>
        </section>

        {/* Veteran Profile shortcut */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Claim Data</h2>
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Veteran Profile</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Contact, service history, exposures, and pay information
              </p>
            </div>
            <Link
              href="/veteran-profile"
              className="px-4 py-1.5 text-sm font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition"
            >
              Edit Profile
            </Link>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h2>
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Delete Account</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Permanently removes your account and all associated data.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-1.5 text-sm font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
            >
              Delete Account
            </button>
          </div>
        </section>
      </main>

      {showDeleteModal && (
        <DeleteModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            await api.deleteAccount();
            auth.clearAll();
            router.replace("/auth/register");
          }}
        />
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueClass = "text-gray-700",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="px-6 py-3.5 flex items-center gap-3">
      {icon}
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

function DeleteModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmed = input === "DELETE";

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onConfirm();
    } catch {
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Delete your account?</h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-700 leading-relaxed">
          <strong>This action cannot be undone.</strong> Deleting your account will permanently
          remove all of your data from our systems, including:
          <ul className="mt-2 ml-4 list-disc space-y-0.5 text-red-600">
            <li>All claim sessions and interview history</li>
            <li>All uploaded documents and medical records</li>
            <li>All generated nexus letters and assessments</li>
            <li>Your veteran profile and contact information</li>
          </ul>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Permanently Delete Account"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
