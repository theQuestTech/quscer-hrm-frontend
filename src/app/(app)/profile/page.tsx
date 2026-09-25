"use client";

// My Profile: the employee's own record. They fill in personal details,
// emergency contacts and their own documents, and set their photo. Job
// details and bank account are shown but only HR can change them.

import { useEffect, useState } from "react";
import { Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName, humanize, toDateInput, todayInput } from "@/lib/format";
import type { EmployeeProfile } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { PhotoEditor } from "@/components/photo";

const GENDERS = [
  ["MALE", "Male"],
  ["FEMALE", "Female"],
  ["OTHER", "Other"],
];
const MARITAL = [
  ["SINGLE", "Single"],
  ["MARRIED", "Married"],
  ["DIVORCED", "Divorced"],
  ["WIDOWED", "Widowed"],
];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function MyProfilePage() {
  const { me, refresh } = useAuth();
  const profile = useApi<EmployeeProfile>(me?.employee ? "/me/profile" : null);

  if (!me?.employee) {
    return (
      <>
        <PageHeader title="My Profile" />
        <Alert tone="info">Your login isn&apos;t linked to an employee profile in this company. Ask HR to link it.</Alert>
      </>
    );
  }
  if (profile.loading && !profile.data) return <Spinner />;
  if (profile.error) return <Alert>{profile.error}</Alert>;
  const p = profile.data;
  if (!p) return null;

  return (
    <>
      <PageHeader title="My Profile" description="Keep your details up to date. HR can see everything on this page." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <PhotoEditor
                employeeId={p.id}
                person={p}
                updatedAt={p.photoUpdatedAt}
                canEdit
                onChange={async () => {
                  await profile.reload();
                  await refresh();
                }}
              />
              <div className="text-right">
                <p className="text-lg font-bold text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
                  {fullName(p)}
                </p>
                <p className="text-sm text-gray-500">{p.designation}</p>
                <span className="mt-1 inline-block rounded-full bg-[#e8faf8] px-2.5 py-1 text-[11px] font-semibold text-[#00857a]">
                  {p.employeeNumber}
                </span>
              </div>
            </div>
          </Card>
          <PersonalDetails profile={p} onSaved={profile.reload} />
          <Contacts profile={p} onChange={profile.reload} />
          <Documents profile={p} onChange={profile.reload} />
        </div>
        <div className="space-y-6">
          <JobDetails profile={p} />
          <Card title="Bank account">
            {p.bankDetail ? (
              <dl className="space-y-2 text-sm">
                <Row label="Bank" value={p.bankDetail.bankName} />
                <Row label="Account title" value={p.bankDetail.accountTitle} />
                <Row label="Account number" value={p.bankDetail.accountNumberLast4 ? `•••• ${p.bankDetail.accountNumberLast4}` : "—"} />
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Not added yet.</p>
            )}
            <p className="mt-3 text-xs text-gray-500">To add or change your bank account, ask HR. This keeps your salary safe.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-[#1a1a2e]">{value || "—"}</dd>
    </div>
  );
}

function JobDetails({ profile: p }: { profile: EmployeeProfile }) {
  return (
    <Card title="Job details">
      <dl className="space-y-2 text-sm">
        <Row label="Work email" value={p.email} />
        <Row label="Job title" value={p.designation} />
        <Row label="Department" value={p.department?.name} />
        <Row label="Branch" value={p.branch?.name} />
        <Row label="Reports to" value={p.manager ? fullName(p.manager) : null} />
        <Row label="Joined" value={formatDate(p.dateOfJoining)} />
        <Row label="Employment" value={humanize(p.employmentType)} />
        <Row label="Shift" value={p.shift ? `${p.shift.name} (${p.shift.startTime}–${p.shift.endTime})` : null} />
      </dl>
      <p className="mt-3 text-xs text-gray-500">Something wrong here? Ask HR to correct it.</p>
    </Card>
  );
}

type Form = {
  fatherName: string;
  cnic: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  phone: string;
  personalEmail: string;
  address: string;
  city: string;
};

function toForm(p: EmployeeProfile): Form {
  return {
    fatherName: p.fatherName ?? "",
    cnic: p.cnic ?? "",
    dateOfBirth: toDateInput(p.dateOfBirth),
    gender: p.gender ?? "",
    maritalStatus: p.maritalStatus ?? "",
    bloodGroup: p.bloodGroup ?? "",
    phone: p.phone ?? "",
    personalEmail: p.personalEmail ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
  };
}

function PersonalDetails({ profile, onSaved }: { profile: EmployeeProfile; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => setForm(toForm(profile)), [profile]);
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      // Empty fields are sent as null so a cleared field is removed.
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]));
      await api("PATCH", "/me/profile", payload);
      setMessage({ tone: "success", text: "Your details are saved." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Personal details">
      <form onSubmit={save} className="space-y-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" hint="As on your record — ask HR to correct it">
            <Input value={fullName(profile)} disabled />
          </Field>
          <Field label="Father's name">
            <Input value={form.fatherName} onChange={set("fatherName")} maxLength={100} />
          </Field>
          <Field label="CNIC" hint="Format: 35202-1234567-1">
            <Input value={form.cnic} onChange={set("cnic")} placeholder="35202-1234567-1" pattern="\d{5}-\d{7}-\d" inputMode="numeric" />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} max={todayInput()} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option value="">—</option>
              {GENDERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marital status">
            <Select value={form.maritalStatus} onChange={set("maritalStatus")}>
              <option value="">—</option>
              {MARITAL.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Blood group">
            <Select value={form.bloodGroup} onChange={set("bloodGroup")}>
              <option value="">—</option>
              {BLOOD.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phone">
            <Input type="tel" value={form.phone} onChange={set("phone")} maxLength={30} placeholder="0300-1234567" />
          </Field>
          <Field label="Personal email">
            <Input type="email" value={form.personalEmail} onChange={set("personalEmail")} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={set("city")} maxLength={60} />
          </Field>
          <Field label="Home address" className="sm:col-span-2">
            <Textarea value={form.address} onChange={set("address")} maxLength={300} rows={2} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Contacts({ profile, onChange }: { profile: EmployeeProfile; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", isPrimary: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/me/emergency-contacts", form);
      setOpen(false);
      setForm({ name: "", relationship: "", phone: "", isPrimary: false });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await api("DELETE", `/me/emergency-contacts/${id}`);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  return (
    <Card
      title="Emergency contacts"
      padded={false}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add
        </Button>
      }
    >
      {error && !open && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {profile.emergencyContacts.length === 0 ? (
        <EmptyState title="No emergency contacts yet" description="Add someone HR can call in an emergency." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {profile.emergencyContacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {c.name} {c.isPrimary && <Badge tone="blue">Primary</Badge>}
                </p>
                <p className="text-gray-500">
                  {c.relationship} · {c.phone}
                </p>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id, c.name)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add emergency contact">
        <form onSubmit={add} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Relationship">
            <Input required placeholder="Father, spouse, sibling…" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
            Main contact
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Add contact
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function Documents({ profile, onChange }: { profile: EmployeeProfile; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setError("That file is bigger than 5 MB. Please make it smaller and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("category", category);
      if (expiryDate) body.append("expiryDate", expiryDate);
      body.append("file", file as File);
      await api("POST", "/me/documents/upload", body);
      setOpen(false);
      setCategory("");
      setExpiryDate("");
      setFile(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="My documents"
      padded={false}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Upload
        </Button>
      }
    >
      {error && !open && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {profile.documents.length === 0 ? (
        <EmptyState title="No documents yet" description="Upload your CNIC, degrees, experience letters and so on." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {profile.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                {d.fileName ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-[#00857a] hover:underline"
                    onClick={async () => {
                      try {
                        await downloadFile(`/me/documents/${d.id}/file`, d.fileName ?? "document");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not download");
                      }
                    }}
                  >
                    <Download className="size-4" aria-hidden /> {d.category}
                  </button>
                ) : (
                  <a href={d.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#00857a] hover:underline">
                    <ExternalLink className="size-4" aria-hidden /> {d.category}
                  </a>
                )}
                <p className="text-gray-500">
                  Added {formatDate(d.uploadedAt)}
                  {d.expiryDate && ` · Expires ${formatDate(d.expiryDate)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">To remove a document, ask HR.</p>
      <Modal open={open} onClose={() => setOpen(false)} title="Upload a document">
        <form onSubmit={upload} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="What is it?">
            <Input required placeholder="CNIC, Degree, Experience letter…" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="File" hint="PDF, JPG or PNG, up to 5 MB.">
            <Input
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
            />
          </Field>
          <Field label="Expiry date (optional)" hint="For example when your CNIC expires">
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Upload
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
