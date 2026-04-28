const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Token storage (sessionStorage clears on tab close; upgrade to httpOnly cookies for production)
const getToken = () =>
  typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null;
const getRefreshToken = () =>
  typeof window !== "undefined" ? sessionStorage.getItem("refresh_token") : null;

export const auth = {
  setTokens(access: string, refresh: string) {
    sessionStorage.setItem("access_token", access);
    sessionStorage.setItem("refresh_token", refresh);
  },
  clearTokens() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
  },
  setName(firstName: string) {
    if (typeof window !== "undefined") localStorage.setItem("user_first_name", firstName);
  },
  getName(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem("user_first_name") : null;
  },
  clearAll() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    localStorage.removeItem("user_first_name");
  },
  isAuthenticated() {
    return !!getToken();
  },
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    // Try to refresh
    const refresh = getRefreshToken();
    if (refresh) {
      const refreshRes = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        auth.setTokens(data.access_token, data.refresh_token);
        if (data.first_name) auth.setName(data.first_name);
        return request<T>(path, options, false);
      }
    }
    auth.clearAll();
    window.location.href = "/auth/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  register: (
    email: string,
    password: string,
    persistence_opt_in: boolean,
    first_name: string,
    middle_name: string | null,
    last_name: string
  ) =>
    request<any>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, persistence_opt_in, first_name, middle_name, last_name }),
    }),

  login: (email: string, password: string) =>
    request<{ totp_required: boolean; totp_setup_required?: boolean; partial_token?: string; setup_token?: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  verifyEmail: (token: string) =>
    request<any>(`/api/auth/verify-email?token=${token}`, { method: "GET" }),

  totpSetupUrl: () => `${API}/api/auth/totp/setup`,

  totpVerify: (code: string) =>
    request<{ access_token: string; refresh_token: string; first_name?: string }>(
      "/api/auth/totp/verify",
      { method: "POST", body: JSON.stringify({ code }) }
    ),

  me: () => request<{ first_name: string | null; last_name: string | null; email: string }>("/api/auth/me"),

  logout: () => {
    auth.clearAll();
    return request<any>("/api/auth/logout", { method: "POST" });
  },

  // Cases
  listCases: () => request<any[]>("/api/cases"),
  createCase: (title: string) =>
    request<any>("/api/cases", { method: "POST", body: JSON.stringify({ title }) }),
  getCase: (id: string) => request<any>(`/api/cases/${id}`),
  deleteCase: (id: string) => request<any>(`/api/cases/${id}`, { method: "DELETE" }),

  // Documents
  listDocuments: (caseId: string) => request<any[]>(`/api/cases/${caseId}/documents`),
  deleteDocument: (caseId: string, docId: string) =>
    request<any>(`/api/cases/${caseId}/documents/${docId}`, { method: "DELETE" }),
  reviewDocument: (caseId: string, docId: string) =>
    request<any>(`/api/cases/${caseId}/documents/${docId}/review`, { method: "POST" }),

  uploadDocument: async (caseId: string, file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/cases/${caseId}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Upload failed");
    }
    return res.json();
  },

  // Chat
  getChatHistory: (caseId: string) => request<any[]>(`/api/cases/${caseId}/chat/history`),

  sendMessage: (caseId: string, content: string): EventSource => {
    return null as any; // handled inline in the component
  },

  sendMessageStream: async (
    caseId: string,
    content: string,
    onChunk: (text: string) => void,
    onDone: (currentPhase?: number) => void
  ) => {
    const token = getToken();
    const res = await fetch(`${API}/api/cases/${caseId}/chat/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Request failed");
    }
    if (!res.body) throw new Error("No response stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let data: any;
        try { data = JSON.parse(line.slice(6)); } catch { continue; }
        if (data.error) throw new Error(data.error);
        if (data.text) onChunk(data.text);
        if (data.done) onDone(data.current_phase);
      }
    }
  },

  // Assessment
  runAssessment: (caseId: string) =>
    request<any>(`/api/cases/${caseId}/assess`, { method: "POST" }),
  getAssessment: (caseId: string) => request<any>(`/api/cases/${caseId}/assessment`),

  // Letters
  listLetters: (caseId: string) => request<any[]>(`/api/cases/${caseId}/letters`),
  generateLetter: (caseId: string, data: any) =>
    request<any>(`/api/cases/${caseId}/letters`, { method: "POST", body: JSON.stringify(data) }),

  // Veteran Profile
  getVeteranProfile: () => request<any>("/api/veteran-profile"),
  updateVeteranProfile: (data: any) =>
    request<any>("/api/veteran-profile", { method: "PUT", body: JSON.stringify(data) }),

  // Profile Chat
  profileChatGreeting: (section: string) =>
    request<{ greeting: string }>(`/api/profile-chat/greeting/${section}`),
  profileChatSend: (section: string, messages: { role: string; content: string }[], currentData?: any) =>
    request<{ reply: string; field_updates: Record<string, any> | null }>("/api/profile-chat/send", {
      method: "POST",
      body: JSON.stringify({ section, messages, current_data: currentData }),
    }),

  // Account
  deleteAccount: () => request<any>("/api/auth/account", { method: "DELETE" }),

  // VA Forms (public — no auth needed). Uses relative paths so requests go
  // through the Next.js rewrite (dev) or nginx proxy (prod), keeping forms
  // same-origin with the page so iframe preview works without CORS issues.
  listForms: () => fetch(`/api/forms`).then((r) => r.json()),

  /** Same-origin URL for a blank VA form PDF — usable as iframe src or download href. */
  getFormPdfUrl: (formId: string) => `/api/forms/${formId}/pdf`,

  // Case-scoped 21-526EZ form (auto-populated from profile + assessment, plus user overrides)
  getCaseForm: (caseId: string) => request<any>(`/api/cases/${caseId}/form/21-526ez`),
  saveCaseForm: (caseId: string, overrides: any) =>
    request<any>(`/api/cases/${caseId}/form/21-526ez`, {
      method: "PUT",
      body: JSON.stringify({ overrides }),
    }),

  /** Fetch the filled 21-526EZ PDF as a Blob (auth'd; works for preview or download). */
  fetchFilledFormBlob: async (caseId: string): Promise<Blob> => {
    const token =
      typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null;
    const res = await fetch(`${API}/api/cases/${caseId}/form/21-526ez/pdf/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Failed to generate PDF");
    }
    return res.blob();
  },

  /** Trigger a browser download of the filled PDF. */
  downloadFilledForm: async (caseId: string) => {
    const blob = await api.fetchFilledFormBlob(caseId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VA-Form-21-526EZ-case-${caseId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
