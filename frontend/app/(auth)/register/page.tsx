"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persistOptIn, setPersistOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.register(email, password, persistOptIn);
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
      <p className="text-gray-500 text-sm mb-6">Prepare your VA disability claim securely</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Min. 12 characters, one uppercase, one number
          </p>
        </div>

        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
          <input
            id="persist"
            type="checkbox"
            checked={persistOptIn}
            onChange={(e) => setPersistOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 text-brand-600 rounded"
          />
          <label htmlFor="persist" className="text-sm text-gray-700">
            <span className="font-medium">Save my claim data</span> — store my interview responses,
            uploaded documents, and generated letters between sessions. You can delete your data at
            any time.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-4">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
