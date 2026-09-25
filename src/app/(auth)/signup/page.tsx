"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ organizationName: "", firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form);
      router.replace("/settings?welcome=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Create your company account</h1>
      <p className="mt-1 text-sm text-slate-500">You&apos;ll be the HR admin. You can add your team afterwards.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Company name">
          <Input required minLength={2} value={form.organizationName} onChange={set("organizationName")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
          </Field>
          <Field label="Last name">
            <Input required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
          </Field>
        </div>
        <Field label="Work email">
          <Input type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </>
  );
}
