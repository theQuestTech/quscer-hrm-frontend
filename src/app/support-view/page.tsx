"use client";

import { useEffect, useState } from "react";
import { setViewToken } from "@/lib/api";

// Opened by the support console in a new tab: keeps the read-only view's
// key for this tab only, removes it from the address bar, and opens HRM.
export default function SupportViewStart() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) return setFailed(true);
    setViewToken(token);
    window.location.replace("/");
  }, []);
  return (
    <p className="p-10 text-center text-sm text-slate-500">
      {failed ? "This link has no support view in it. Start the view again from the support console." : "Opening the read-only view…"}
    </p>
  );
}
