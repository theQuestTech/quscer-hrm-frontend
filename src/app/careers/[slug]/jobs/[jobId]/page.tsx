"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { publicApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CompanyHeader, type PublicJob, jobFacts } from "@/components/careers";
import { Alert, Button, Field, Input, Spinner, Textarea } from "@/components/ui";

export default function PublicJobPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const [data, setData] = useState<{ company: string; job: PublicJob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    publicApi<{ company: string; job: PublicJob }>("GET", `/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(jobId)}`)
      .then((d) => {
        setData(d);
        document.title = `${d.job.title} · ${d.company}`;
      })
      .catch((e) => setError(e.status === 404 ? "This job is no longer open." : e.message));
  }, [slug, jobId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const cv = form.get("cv");
    if (!(cv instanceof File) || cv.size === 0) return setFormError("Please attach your CV.");
    if (cv.size > 5 * 1024 * 1024) return setFormError("Your CV can be at most 5 MB.");
    for (const key of ["city", "currentCompany", "expectedSalary", "noticePeriodDays", "coverNote", "website"]) {
      if (!String(form.get(key) ?? "").trim()) form.delete(key);
    }
    setSending(true);
    try {
      await publicApi("POST", `/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(jobId)}/apply`, form);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send your application");
    } finally {
      setSending(false);
    }
  }

  const back = (
    <Link href={`/careers/${slug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
      <ArrowLeft className="size-4" /> All jobs
    </Link>
  );
  if (error)
    return (
      <>
        {back}
        <Alert>{error}</Alert>
      </>
    );
  if (!data) return <Spinner />;
  const j = data.job;

  return (
    <>
      {back}
      <CompanyHeader company={data.company} subtitle={j.title} />
      {sent ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200" role="status">
          <p className="text-lg font-semibold text-[#1a1a2e]">Thank you — your application was sent</p>
          <p className="mt-2 text-sm text-slate-600">
            {data.company} will contact you by email or phone if your profile is a good fit.
          </p>
          <Link href={`/careers/${slug}`} className="mt-6 inline-block text-sm font-medium text-[#00857a] hover:underline">
            See other jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{jobFacts(j)}</p>
            {j.salaryRange && <p className="mt-1 text-sm font-medium text-slate-900">{j.salaryRange}</p>}
            <h2 className="mt-5 mb-2 font-semibold text-[#1a1a2e]">About the job</h2>
            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{j.description}</p>
            {j.requirements && (
              <>
                <h2 className="mt-5 mb-2 font-semibold text-[#1a1a2e]">What we&apos;re looking for</h2>
                <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{j.requirements}</p>
              </>
            )}
            <p className="mt-5 text-xs text-slate-400">
              Posted {formatDate(j.postedAt)}
              {j.closesAt && ` · Apply by ${formatDate(j.closesAt)}`}
            </p>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="apply-heading">
            <h2 id="apply-heading" className="mb-4 text-lg font-semibold text-[#1a1a2e]">
              Apply for this job
            </h2>
            <form onSubmit={submit} className="space-y-4" noValidate={false}>
              {formError && <Alert>{formError}</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" required maxLength={60} autoComplete="given-name" />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" required maxLength={60} autoComplete="family-name" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required maxLength={120} autoComplete="email" />
                </Field>
                <Field label="Phone / WhatsApp">
                  <Input name="phone" type="tel" required placeholder="0300 1234567" pattern="[+0-9 ()\-]{7,20}" autoComplete="tel" />
                </Field>
                <Field label="City (optional)">
                  <Input name="city" maxLength={60} autoComplete="address-level2" />
                </Field>
                <Field label="Current company (optional)">
                  <Input name="currentCompany" maxLength={120} autoComplete="organization" />
                </Field>
                <Field label="Expected monthly salary (optional)">
                  <Input name="expectedSalary" type="number" min={0} inputMode="numeric" />
                </Field>
                <Field label="Notice period in days (optional)">
                  <Input name="noticePeriodDays" type="number" min={0} max={365} inputMode="numeric" />
                </Field>
              </div>
              <Field label="CV (PDF or Word, up to 5 MB)">
                <Input name="cv" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
              </Field>
              <Field label="Anything you'd like to add (optional)">
                <Textarea name="coverNote" rows={4} maxLength={3000} />
              </Field>
              {/* Left empty by people; bots fill it in. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Your details and CV go only to {data.company}&apos;s HR team to consider you for this job.
              </p>
              <Button type="submit" loading={sending} className="w-full sm:w-auto">
                Send application
              </Button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
