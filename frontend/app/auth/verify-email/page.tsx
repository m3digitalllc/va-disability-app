"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");
  const [status, setStatus] = useState<"pending" | "loading" | "success" | "error">(
    token ? "loading" : "pending"
  );

  useEffect(() => {
    if (!token) return;
    api
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "pending") {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <Mail className="w-12 h-12 text-brand-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm">
            We sent a verification link to <strong>{email}</strong>. Click the link to verify your
            account, then come back to set up two-factor authentication.
          </p>
        </div>
        <p className="text-sm text-gray-400 text-center mt-6">
          Wrong email?{" "}
          <Link href="/auth/register" className="text-brand-600 hover:underline">
            Start over
          </Link>
        </p>
      </>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center text-center">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
        <p className="text-gray-600">Verifying your email…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email verified!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your email is confirmed. Sign in to set up two-factor authentication.
        </p>
        <Link
          href="/auth/login"
          className="px-6 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <XCircle className="w-12 h-12 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification failed</h1>
      <p className="text-gray-500 text-sm mb-6">
        This link is invalid or has expired. Please register again.
      </p>
      <Link
        href="/auth/register"
        className="px-6 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition"
      >
        Register
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
