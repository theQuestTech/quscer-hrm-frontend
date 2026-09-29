"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supportApi, useSupport } from "@/lib/support";
import { SupportAuthFrame } from "@/components/support-auth-frame";
import { TwoStepSetup } from "@/components/two-step";
import { Spinner } from "@/components/ui";

// Every support person needs two-step sign-in: new staff land here after their
// first sign-in, and so does anyone whose two-step the owner reset.
export default function SupportTwoStepSetupPage() {
  const { agent, loading, refresh } = useSupport();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !agent) router.replace("/support/login");
    else if (agent?.twoStepOn) router.replace("/support");
  }, [loading, agent, router]);

  if (loading || !agent || agent.twoStepOn) return <Spinner />;
  return (
    <SupportAuthFrame>
      <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Set up two-step sign-in
      </h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Support accounts can open every company, so each sign-in also needs a code from your phone.</p>
      <TwoStepSetup compact client={supportApi} base="/support/two-step" onDone={() => refresh()} />
    </SupportAuthFrame>
  );
}
