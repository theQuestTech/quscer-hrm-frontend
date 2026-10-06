"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { API_URL } from "@/lib/api";

// On the staging server (QUSCER_ENV=staging on the API) every page carries this badge
// and the tab title starts with "[Staging]", so nobody mistakes demo data for real.
// The live app shows nothing.
export function StagingBadge() {
  const [staging, setStaging] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/environment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.environment === "staging") setStaging(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!staging) return;
    const mark = () => {
      if (!document.title.startsWith("[Staging]")) document.title = `[Staging] ${document.title}`;
    };
    mark();
    // Pages set their own title later (and may swap the <title> element), so keep checking.
    const timer = setInterval(mark, 1000);
    return () => clearInterval(timer);
  }, [staging]);

  if (!staging) return null;
  return (
    <div
      role="status"
      title="This is the staging copy of Quscer People — test and demo data only. Nothing here is real."
      className="pointer-events-none fixed bottom-3 left-3 z-[100] flex select-none items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-900 shadow-lg print:hidden"
    >
      <FlaskConical size={13} /> Staging · test data only
    </div>
  );
}
