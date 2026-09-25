// Thin fetch wrapper around the quscer-hrm-backend API. The JWT lives in
// localStorage — this app is standalone until it's connected to Quscer OS
// (WBS 6.1), at which point sign-in moves to the shared Quscer session.

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100").replace(/\/$/, "");
const TOKEN_KEY = "quscer-hrm-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked (private mode etc.) — the session just won't persist
  }
}

// Called on any 401 so the auth provider can send the user back to sign-in.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// NestJS errors look like { message: string | string[], error, statusCode }.
function errorMessage(body: unknown, fallback: string): string {
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
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// For PDF payslips: fetch with the auth header, then hand the browser a file.
export async function downloadFile(path: string, filename: string) {
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
}
