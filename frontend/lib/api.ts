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
        return request<T>(path, options, false);
      }
    }
    auth.clearTokens();
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
  register: (email: string, password: string, persistence_opt_in: boolean) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, persistence_opt_in }),
    }),

  login: (email: string, password: string) =>
    request<{ totp_required: boolean; totp_setup_required?: boolean; partial_token?: string; setup_token?: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  verifyEmail: (token: string) =>
    request(`/api/auth/verify-email?token=${token}`, { method: "GET" }),

  totpSetupUrl: () => `${API}/api/auth/totp/setup`,

  totpVerify: (code: string) =>
    request<{ access_token: string; refresh_token: string }>(
      "/api/auth/totp/verify",
      { method: "POST", body: JSON.stringify({ code }) }
    ),

  logout: () => {
    auth.clearTokens();
    return request("/api/auth/logout", { method: "POST" });
  },

  // Cases
  listCases: () => request<any[]>("/api/cases"),
  createCase: (title: string) =>
    request("/api/cases", { method: "POST", body: JSON.stringify({ title }) }),
  getCase: (id: string) => request<any>(`/api/cases/${id}`),
  deleteCase: (id: string) => request(`/api/cases/${id}`, { method: "DELETE" }),

  // Documents
  listDocuments: (caseId: string) => request<any[]>(`/api/cases/${caseId}/documents`),
  deleteDocument: (caseId: string, docId: string) =>
    request(`/api/cases/${caseId}/documents/${docId}`, { method: "DELETE" }),

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
    // For SSE we use fetch streaming directly
    return null as any; // handled inline in the component
  },

  sendMessageStream: async (
    caseId: string,
    content: string,
    onChunk: (text: string) => void,
    onDone: () => void
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

    if (!res.ok || !res.body) throw new Error("Stream failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
        if (data.text) onChunk(data.text);
        if (data.done) onDone();
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
    request(`/api/cases/${caseId}/letters`, { method: "POST", body: JSON.stringify(data) }),
};
