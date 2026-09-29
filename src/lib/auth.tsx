"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Me } from "./types";
import { saveTrustedToken, tokenNeedsSetup, trustedToken } from "./two-step";

interface AuthState {
  me: Me | null;
  loading: boolean;
  // Password step. Returns a challenge when the 6-digit code is needed next.
  login: (email: string, password: string) => Promise<{ challengeToken: string } | void>;
  // Code step: the 6-digit code or a backup code.
  loginWithCode: (email: string, challengeToken: string, input: { code?: string; backupCode?: string; trustDevice?: boolean }) => Promise<void>;
  // Two-step sign-in is required for this person and not set up yet.
  setupRequired: boolean;
  // A new sign-in from the server (e.g. after turning two-step on).
  applyToken: (accessToken: string) => Promise<void>;
  signup: (input: {
    organizationName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  // Open another company this login has access to.
  switchCompany: (organizationId: string) => Promise<void>;
  // Create a new company (you become its HR Admin) and open it.
  addCompany: (organizationName: string) => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me>("GET", "/auth/me"));
    } catch (e) {
      // Only a rejected sign-in ends the session. A dropped connection — or
      // a request cut off because the user moved to another page — keeps it.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) logout();
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    refresh().finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [refresh, logout]);

  // Read from the sign-in itself, so pages know before they load anything.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setupRequired = useMemo(() => tokenNeedsSetup(getToken()), [me]);

  const applyToken = useCallback(
    async (accessToken: string) => {
      setToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken?: string; twoStepRequired?: boolean; challengeToken?: string }>("POST", "/auth/login", {
        email,
        password,
        trustedDeviceToken: trustedToken(email),
      });
      if (res.twoStepRequired && res.challengeToken) return { challengeToken: res.challengeToken };
      await applyToken(res.accessToken!);
    },
    [applyToken],
  );

  const loginWithCode = useCallback<AuthState["loginWithCode"]>(
    async (email, challengeToken, input) => {
      const res = await api<{ accessToken: string; trustedDeviceToken?: string }>("POST", "/auth/login/two-step", { challengeToken, ...input });
      if (res.trustedDeviceToken) saveTrustedToken(email, res.trustedDeviceToken);
      await applyToken(res.accessToken);
    },
    [applyToken],
  );

  const signup = useCallback<AuthState["signup"]>(
    async (input) => {
      const { accessToken } = await api<{ accessToken: string }>("POST", "/auth/signup", input);
      setToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const switchCompany = useCallback(
    async (organizationId: string) => {
      const { accessToken } = await api<{ accessToken: string }>("POST", "/auth/switch-company", { organizationId });
      setToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const addCompany = useCallback(
    async (organizationName: string) => {
      const { accessToken } = await api<{ accessToken: string }>("POST", "/auth/companies", { organizationName });
      setToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      login,
      loginWithCode,
      setupRequired,
      applyToken,
      signup,
      logout,
      refresh,
      switchCompany,
      addCompany,
      can: (permission) => !!me?.permissions.includes(permission),
    }),
    [me, loading, login, loginWithCode, setupRequired, applyToken, signup, logout, refresh, switchCompany, addCompany],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
