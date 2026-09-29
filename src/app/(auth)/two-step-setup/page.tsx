"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TwoStepSetup } from "@/components/two-step";
import { Spinner } from "@/components/ui";

// For anyone who handles pay, employee records or settings (or everyone, if
// the company chose that) until they turn on two-step sign-in. Nothing else
// in HRM opens until then.
// Back to where they were going (only our own pages).
function destination() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function TwoStepSetupPage() {
  const { me, loading, setupRequired, applyToken, logout } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
    else if (!loading && me && !setupRequired) router.replace(destination());
  }, [loading, me, setupRequired, router]);
  if (loading || !me || !setupRequired) return <Spinner />;
  return (
    <>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-6 text-brand-600" />
        <h1 className="text-2xl font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
          Set up two-step sign-in
        </h1>
      </div>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        Your role handles pay, employee records or settings, so after your password you’ll also type a 6-digit code from an app on your phone. A stolen password alone
        can’t get in. It takes about a minute.
      </p>
      <TwoStepSetup
        compact
        onDone={async (token) => {
          // Signed in without the "setup required" flag; the check above
          // then takes them on to where they were going.
          await applyToken(token);
        }}
      />
      <button onClick={logout} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
        Sign out and do this later
      </button>
    </>
  );
}
