"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, User, Settings, LogOut, FileText } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  /** Tailwind max-width class for the header content. Defaults to max-w-6xl. */
  maxWidth?: string;
}

export default function AppHeader({ maxWidth = "max-w-6xl" }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // logout best-effort — proceed to login regardless
    }
    router.replace("/auth/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className={`${maxWidth} mx-auto flex justify-between items-center`}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-brand-700 hover:text-brand-800 transition"
        >
          <Shield className="w-5 h-5" />
          VA Claims Assistant
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/veteran-profile"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition"
          >
            <User className="w-4 h-4" />
            My Profile
          </Link>
          <Link
            href="/forms"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition"
          >
            <FileText className="w-4 h-4" />
            VA Forms
          </Link>
          <Link
            href="/account"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition"
          >
            <Settings className="w-4 h-4" />
            Account
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
