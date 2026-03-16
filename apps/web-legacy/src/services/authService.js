const TOKEN_STORAGE_KEY = "floppystack.auth.token";

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

export function setAuthToken(token) {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  setAuthToken("");
}

export function makeAuthHeaders(extra = {}) {
  const token = getAuthToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function register({ username, password, displayName, callsign }) {
  const payload = await requestJson("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, displayName, callsign }),
  });
  setAuthToken(payload?.token || "");
  return payload?.user || null;
}

export async function login({ username, password }) {
  const payload = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(payload?.token || "");
  return payload?.user || null;
}

export async function me() {
  const token = getAuthToken();
  if (!token) return null;
  const payload = await requestJson("/api/auth/me", {
    headers: makeAuthHeaders(),
  });
  return payload?.user || null;
}

export async function logout() {
  try {
    const token = getAuthToken();
    if (token) {
      await requestJson("/api/auth/logout", {
        method: "POST",
        headers: makeAuthHeaders(),
      });
    }
  } finally {
    clearAuthToken();
  }
}
