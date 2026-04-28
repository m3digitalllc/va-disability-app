"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, auth } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function TwoFAVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const partialToken = sessionStorage.getItem("partial_token");
    if (!partialToken) {
      router.replace("/auth/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/totp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partialToken}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Invalid code");
      }
      const data = await res.json();
      sessionStorage.removeItem("partial_token");
      auth.setTokens(data.access_token, data.refresh_token);
      if (data.first_name) auth.setName(data.first_name);
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-factor verification</h1>
      <p className="text-gray-500 text-sm mb-6">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-full px-3 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-center text-3xl tracking-widest font-mono"
        />

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-2.5 px-4 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Sign In"}
        </button>
      </form>
    </>
  );
}
