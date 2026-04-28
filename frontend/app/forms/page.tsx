"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { api, auth } from "@/lib/api";
import AppHeader from "@/components/AppHeader";

interface VaForm {
  id: string;
  filename: string;
  title: string;
  subtitle: string;
  revision: string;
  pages: number;
  description: string;
  canonical_source: string;
  available: boolean;
}

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<VaForm[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    api
      .listForms()
      .then((list: VaForm[]) => {
        setForms(list);
        if (list.length > 0) setActiveId(list[0].id);
      })
      .catch(() => setForms([]));
  }, [router]);

  const activeForm = forms?.find((f) => f.id === activeId) ?? null;
  const pdfUrl = activeForm ? api.getFormPdfUrl(activeForm.id) : null;

  if (!forms) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader maxWidth="max-w-6xl" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader maxWidth="max-w-6xl" />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">VA Forms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Download the official VA forms you'll need to submit your claim. Files are byte-identical
            to the VA's published versions — print, sign, and submit by mail or online at va.gov.
          </p>
        </div>

        {forms.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              No forms are currently configured. Contact your administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form list */}
            <aside className="lg:col-span-1 space-y-2">
              {forms.map((f) => {
                const isActive = activeId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveId(f.id)}
                    className={`w-full text-left p-4 rounded-xl border transition ${
                      isActive
                        ? "border-brand-300 bg-white ring-1 ring-brand-200 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          isActive ? "text-brand-600" : "text-gray-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{f.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.subtitle}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Revision {f.revision} · {f.pages} pages
                          {!f.available && (
                            <span className="ml-2 text-amber-600 font-medium">· Not installed</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Preview + actions */}
            {activeForm && (
              <section className="lg:col-span-2 space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{activeForm.title}</h2>
                      <p className="text-sm text-gray-600 mt-0.5">{activeForm.subtitle}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        Revision {activeForm.revision} · {activeForm.pages} pages
                      </p>
                    </div>
                    <a
                      href={pdfUrl ?? "#"}
                      download={activeForm.filename}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 ${
                        !activeForm.available
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
                          : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                      aria-disabled={!activeForm.available}
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </a>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">{activeForm.description}</p>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
                    <span>
                      <strong className="text-gray-700">Filename:</strong> {activeForm.filename}
                    </span>
                    <a
                      href={activeForm.canonical_source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Verify against VA's canonical source
                    </a>
                  </div>
                </div>

                {/* Preview */}
                {!activeForm.available ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800">Form file not yet installed</p>
                      <p className="text-amber-700 mt-1">
                        Save the official VA PDF to this exact path on the host:
                      </p>
                      <pre className="mt-2 bg-white border border-amber-200 rounded-md p-2.5 text-xs text-amber-900 overflow-x-auto">
                        va-disability-app/backend/data/forms/{activeForm.filename}
                      </pre>
                      <p className="text-amber-700 mt-2">
                        The directory is volume-mounted into the backend container — the file is
                        picked up immediately, no rebuild needed. Refresh this page after dropping
                        the file.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                      Preview — scroll to read all {activeForm.pages} pages
                    </div>
                    <iframe
                      src={`${pdfUrl}#view=FitH`}
                      title={activeForm.title}
                      className="w-full h-[800px] bg-gray-100"
                    />
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
