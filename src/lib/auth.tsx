"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Me } from "./types";

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    organizationName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
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
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    refresh().finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [refresh, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await api<{ accessToken: string }>("POST", "/auth/login", { email, password });
      setToken(accessToken);
      await refresh();
    },
    [refresh],
  );

  const signup = useCallback<AuthState["signup"]>(
    async (input) => {
      const { accessToken } = await api<{ accessToken: string }>("POST", "/auth/signup", input);
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
      signup,
      logout,
      refresh,
      can: (permission) => !!me?.permissions.includes(permission),
    }),
    [me, loading, login, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
