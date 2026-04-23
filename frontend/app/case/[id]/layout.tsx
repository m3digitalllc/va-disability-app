"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Shield, MessageSquare, FileText, ClipboardList, Mail, ArrowLeft } from "lucide-react";

const NAV = [
  { href: "interview", label: "Interview", icon: MessageSquare, phase: 1 },
  { href: "documents", label: "Documents", icon: FileText, phase: 4 },
  { href: "assessment", label: "Assessment", icon: ClipboardList, phase: 5 },
  { href: "letters", label: "Letters", icon: Mail, phase: 5 },
];

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 font-semibold text-brand-700 text-sm">
              <Shield className="w-4 h-4" />
              VA Claims Assistant
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col md:flex-row gap-0 px-4 md:px-6 py-6">
        {/* Sidebar nav */}
        <nav className="w-full md:w-48 shrink-0 mb-4 md:mb-0 md:mr-6">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV.map((item) => {
              const active = pathname.includes(`/${item.href}`);
              return (
                <li key={item.href}>
                  <Link
                    href={`/case/${id}/${item.href}`}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
