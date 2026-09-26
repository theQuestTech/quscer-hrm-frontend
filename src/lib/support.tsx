"use client";

// The Quscer support console's own sign-in. Support staff tokens are kept
// apart from customer sign-ins (a different storage key, and the server signs
// them with a different secret), so neither can open the other.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, ApiError, errorMessage } from "./api";

const KEY = "quscer-support-token";

function getSupportToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function setSupportToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage blocked — the session just won't persist
  }
}

let onSignedOut: (() => void) | null = null;

export async function supportApi<T = unknown>(method: string, path: string, body?: object): Promise<T> {
  const token = getSupportToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) onSignedOut?.();
    throw new ApiError(res.status, errorMessage(data, `Request failed (${res.status})`));
  }
  return data as T;
}

export function useSupportApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const reload = useCallback(async () => {
    if (path === null) return setLoading(false);
    setLoading(true);
    try {
      setData(await supportApi<T>("GET", path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload };
}

// --- Who's signed in ------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface SupportState {
  agent: Agent | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<SupportState | null>(null);

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setSupportToken(null);
    setAgent(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getSupportToken()) return setAgent(null);
    try {
      setAgent(await supportApi<Agent>("GET", "/support/auth/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout();
    }
  }, [logout]);

  useEffect(() => {
    onSignedOut = logout;
    refresh().finally(() => setLoading(false));
    return () => {
      onSignedOut = null;
    };
  }, [refresh, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await supportApi<{ accessToken: string }>("POST", "/support/auth/login", { email, password });
      setSupportToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(() => ({ agent, loading, login, logout }), [agent, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupport() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSupport must be used inside <SupportProvider>");
  return ctx;
}

// --- Shapes from the server ---------------------------------------------------------------

export type TicketStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type EmailStatus = "SENT" | "FAILED" | "DELIVERED" | "BOUNCED" | "COMPLAINED";

export interface Overview {
  companies: number;
  suspended: number;
  activeUsers: number;
  machinesOffline: number;
  emailProblems: number;
  openTickets: number;
  emailEnabled: boolean;
  tickets: Partial<Record<TicketStatus, number>>;
}

export interface CompanyRow {
  id: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  ownerEmail: string | null;
  employees: number;
  logins: number;
  lastSeenAt: string | null;
  machines: { total: number; online: number; notConnected: number };
  emails: { on: boolean; problems24h: number };
  openTickets: number;
}

export interface SupportActivity {
  id: string;
  action: string;
  agentName: string;
  organization: { id: string; name: string } | null;
  userId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface CompanyLogin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  lastSeenAt: string | null;
  hasPassword: boolean;
  canLogIn: boolean;
}

export interface EmailLogRow {
  id: string;
  to: string;
  kind: string;
  subject: string;
  status: EmailStatus;
  error: string | null;
  createdAt: string;
}

export interface CompanyDetail {
  id: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  timezone: string;
  employees: number;
  branches: number;
  payrollRuns: number;
  setup: {
    emailNotifications: boolean;
    checkInMethod: "APP" | "MACHINE" | "BOTH";
    officeNetworkRequired: boolean;
    officeLocationRequired: boolean;
    modules: string[];
  };
  logins: CompanyLogin[];
  machines: {
    id: string;
    name: string;
    kind: "ADMS" | "API" | "IMPORT";
    serialNumber: string | null;
    isActive: boolean;
    lastSeenAt: string | null;
    lastPunchAt: string | null;
  }[];
  emails: EmailLogRow[];
  tickets: { id: string; subject: string; status: TicketStatus; lastMessageAt: string; user: { firstName: string; lastName: string } }[];
  actions: SupportActivity[];
}

export interface TicketMessage {
  id: string;
  body: string;
  createdAt: string;
  fromSupport: boolean;
  author: string;
}

export interface TicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  page: string | null;
  lastMessageAt: string;
  createdAt: string;
  organization: { id: string; name: string };
  user: { id: string; firstName: string; lastName: string; email: string };
  lastMessage: TicketMessage | null;
}

export interface TicketDetail extends Omit<TicketRow, "lastMessage" | "user"> {
  user: TicketRow["user"] & { roles: string[] };
  messages: TicketMessage[];
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
