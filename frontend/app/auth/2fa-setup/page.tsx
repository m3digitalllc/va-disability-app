"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, auth } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function TwoFASetupPage() {
  const router = useRouter();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"scan" | "verify">("scan");

  useEffect(() => {
    const setupToken = sessionStorage.getItem("setup_token");
    if (!setupToken) {
      router.replace("/auth/login");
      return;
    }

    // Fetch QR code + secret as JSON
    fetch(`${API}/api/auth/totp/setup`, {
      headers: { Authorization: `Bearer ${setupToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to get QR code");
        const data: { secret: string; qr_png_base64: string } = await res.json();
        setSecret(data.secret);
        setQrUrl(`data:image/png;base64,${data.qr_png_base64}`);
      })
      .catch((err) => {
        toast.error(err.message);
        router.replace("/auth/login");
      });
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const setupToken = sessionStorage.getItem("setup_token");
    if (!setupToken) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/totp/verify`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${setupToken}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Invalid code");
      }
      const data = await res.json();
      sessionStorage.removeItem("setup_token");
      auth.setTokens(data.access_token);
      if (data.first_name) auth.setName(data.first_name);
      toast.success(`Welcome to VA Claims Assistant${data.first_name ? `, ${data.first_name}` : ""}! Two-factor authentication is enabled.`);
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up two-factor authentication</h1>
      <p className="text-gray-500 text-sm mb-6">
        Scan the QR code with Google Authenticator, Authy, or any TOTP app.
      </p>

      {qrUrl && (
        <div className="flex flex-col items-center mb-6">
          <img src={qrUrl} alt="TOTP QR code" className="w-48 h-48 border rounded-lg" />
          {secret && (
            <p className="text-xs text-gray-400 mt-2 font-mono break-all text-center">
              Manual entry: {secret}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter 6-digit code from your app
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-center text-2xl tracking-widest font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-2.5 px-4 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Enable 2FA & Continue"}
        </button>
      </form>
    </>
  );
}
