// Thin fetch wrapper around the quscer-hrm-backend API. The JWT lives in
// localStorage — this app is standalone until it's connected to Quscer OS
// (WBS 6.1), at which point sign-in moves to the shared Quscer session.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100").replace(/\/$/, "");
const TOKEN_KEY = "quscer-hrm-token";

// For pages anyone can open without signing in (the careers page): no
// token is sent, and a 401 never signs anyone out.
export async function publicApi<T = unknown>(method: string, path: string, body?: FormData | object): Promise<T> {
  let res: Response;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, `Request failed (${res.status})`));
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// A Quscer support "view as" lives only in its own browser tab
// (sessionStorage), so it never replaces anyone's real sign-in.
const VIEW_KEY = "quscer-hrm-view-token";

function viewToken(): string | null {
  try {
    return window.sessionStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const view = viewToken();
  if (view) return view;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    // Signing out of a support view only ends the view.
    if (!token && viewToken()) return window.sessionStorage.removeItem(VIEW_KEY);
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked (private mode etc.) — the session just won't persist
  }
}

export function setViewToken(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(VIEW_KEY, token);
    else window.sessionStorage.removeItem(VIEW_KEY);
  } catch {
    // storage blocked — the view can't open
  }
}

// Called on any 401 so the auth provider can send the user back to sign-in.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// NestJS errors look like { message: string | string[], error, statusCode }.
export function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // FormData (file uploads) sets its own multipart Content-Type.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, errorMessage(data, `Request failed (${res.status})`));
  }
  return res;
}

// `body` may be a FormData for file uploads.
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// For PDF payslips and the bank file: fetch with the auth header, then hand
// the browser a file. Returns the response headers for callers that need them.
export async function downloadFile(path: string, filename: string): Promise<Headers> {
  const res = await request("GET", path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return res.headers;
}

// Pictures behind the login (feed photos): fetch with the auth header and
// return a temporary object URL for <img src>. Callers revoke it when done.
export async function fetchObjectUrl(path: string): Promise<string> {
  const res = await request("GET", path);
  return URL.createObjectURL(await res.blob());
}
