import Link from "next/link";
import { Shield } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
      <Link href="/" className="flex items-center gap-2 text-brand-700 font-bold text-xl mb-8">
        <Shield className="w-6 h-6" />
        VA Claims Assistant
      </Link>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {children}
      </div>
      <p className="mt-6 text-xs text-gray-400 text-center max-w-sm">
        Your information is encrypted and protected. This tool does not provide legal advice.
      </p>
    </div>
  );
}
