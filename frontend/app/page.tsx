import Link from "next/link";
import { Shield, FileText, MessageSquare, Award } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 text-white">
      <nav className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Shield className="w-6 h-6" />
          VA Claims Assistant
        </div>
        <div className="flex gap-4">
          <Link href="/auth/login" className="px-4 py-2 rounded-lg hover:bg-white/10 transition">
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 rounded-lg bg-white text-brand-700 font-semibold hover:bg-brand-50 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Build Your VA Disability Claim<br />With Confidence
        </h1>
        <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
          An investigative interview tool that helps you organize your service history,
          analyze your medical records, and prepare nexus letters — before you meet with your advocate.
        </p>
        <Link
          href="/auth/register"
          className="inline-block px-8 py-4 bg-white text-brand-700 font-bold text-lg rounded-xl hover:bg-brand-50 transition shadow-lg"
        >
          Start Your Claim Prep — Free
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          {[
            {
              icon: <MessageSquare className="w-8 h-8 text-blue-300" />,
              title: "Guided Interview",
              desc: "AI-powered questions walk through your service history, injuries, and current symptoms — one step at a time.",
            },
            {
              icon: <FileText className="w-8 h-8 text-blue-300" />,
              title: "Record Analysis",
              desc: "Upload your medical records and C&P exams. We extract qualifying conditions and map them to VA rating criteria.",
            },
            {
              icon: <Award className="w-8 h-8 text-blue-300" />,
              title: "Nexus Letters",
              desc: "Generate provider letters, personal statements, and buddy letters tailored to your specific conditions.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
              {f.icon}
              <h3 className="text-lg font-semibold mt-3 mb-2">{f.title}</h3>
              <p className="text-blue-100 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-16 text-blue-200 text-sm">
          Your data is encrypted and protected. This tool does not provide legal advice.
        </p>
      </main>
    </div>
  );
}
