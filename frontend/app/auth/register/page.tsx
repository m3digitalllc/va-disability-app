"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { FieldTooltip } from "@/components/ui/FieldTooltip";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persistOptIn, setPersistOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.register(
        email,
        password,
        persistOptIn,
        firstName.trim(),
        middleName.trim() || null,
        lastName.trim()
      );
      setRegistered(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {firstName}!
        </h1>
        <p className="text-gray-500 text-sm mb-2">
          Your account has been created. We sent a verification link to{" "}
          <strong>{email}</strong>.
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Click the link in your email to verify your account, then return here to set up
          two-factor authentication.
        </p>
        <div className="flex items-center gap-2 text-brand-600 text-sm font-medium">
          <Mail className="w-4 h-4" />
          Check your inbox
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Wrong email?{" "}
          <button
            onClick={() => setRegistered(false)}
            className="text-brand-600 hover:underline"
          >
            Start over
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
      <p className="text-gray-500 text-sm mb-6">Prepare your VA disability claim securely</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
              <FieldTooltip text="Your legal first name as it appears on your military service records and government-issued ID." />
            </label>
            <input
              type="text"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
              <FieldTooltip text="Your legal last name as it appears on your military service records and government-issued ID." />
            </label>
            <input
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
            <FieldTooltip text="Your legal middle name. Leave blank if you do not have one or do not wish to provide it." />
          </label>
          <input
            type="text"
            autoComplete="additional-name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email address
            <FieldTooltip text="Used for account verification and notifications. This is your login username." />
          </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
            <FieldTooltip text="Choose a strong password you don't use elsewhere. Minimum 12 characters, one uppercase letter, and one number required." />
          </label>
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
            <span className="font-medium">Save my claim data</span> — store my interview
            responses, uploaded documents, and generated letters between sessions. You can
            delete your data at any time.
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
