"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Loads a GET endpoint and exposes reload() for after a mutation. Pass null
// to skip loading (e.g. when the user lacks the permission for it).
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);

  const reload = useCallback(async () => {
    if (path === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api<T>("GET", path));
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

  return { data, error, loading, reload, setData };
}
