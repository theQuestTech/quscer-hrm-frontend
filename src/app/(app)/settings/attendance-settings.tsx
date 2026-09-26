"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { API_URL, api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatRelative, fullName } from "@/lib/format";
import { currentLocation } from "@/lib/check-in";
import { type DateOrder, detectDelimiter, guessOrder, parseRows, readDateTime } from "@/lib/punch-file";
import type {
  AttendanceDevice, Branch, DeviceKind, Employee, OfficeLocation, OfficeNetwork, OrgSettings, Paginated, PunchResult, UnmatchedId,
} from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Td, Th } from "@/components/ui";

// Settings → Attendance: how people record time, where the app button works,
// attendance machines, IDs the machines sent that nobody has yet, and
// importing a file from a machine.
export function AttendanceSettings() {
  return (
    <div className="space-y-6">
      <DefaultRules />
      <div className="grid gap-6 xl:grid-cols-2">
        <Networks />
        <Locations />
      </div>
      <Machines />
      <UnknownIds />
      <ImportFile />
    </div>
  );
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

// --- Company defaults --------------------------------------------------------------

function DefaultRules() {
  const settings = useApi<OrgSettings>("/settings");
  const l = settings.data?.localeSettings;
  const [form, setForm] = useState<{ method: string; network: boolean; location: boolean } | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  if (settings.loading && !settings.data) return <Spinner />;
  const f = form ?? { method: l?.defaultCheckInMethod ?? "BOTH", network: l?.defaultRequireOfficeNetwork ?? false, location: l?.defaultRequireOfficeLocation ?? false };

  return (
    <Card title="How people record their time">
      <form
        className="max-w-2xl space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setMsg(null);
          try {
            await api("PATCH", "/settings", { defaultCheckInMethod: f.method, defaultRequireOfficeNetwork: f.network, defaultRequireOfficeLocation: f.location });
            setMsg({ tone: "success", text: "Saved" });
            settings.reload();
          } catch (err) {
            setMsg({ tone: "error", text: errorText(err) });
          } finally {
            setSaving(false);
          }
        }}
      >
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <p className="text-sm text-slate-600">
          These are the company defaults. You can change them for one person on their profile (Edit → Attendance) — for example, field staff who
          use the app anywhere while everyone else uses the machine.
        </p>
        <Field label="Default way to record time">
          <Select value={f.method} onChange={(e) => setForm({ ...f, method: e.target.value })}>
            <option value="BOTH">Attendance machine or the app&apos;s slide button</option>
            <option value="MACHINE">Attendance machine only (hide the slide button)</option>
            <option value="APP">App slide button only</option>
          </Select>
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.network} onChange={(e) => setForm({ ...f, network: e.target.checked })} />
          <span>
            Slide button only works on the office network
            <span className="block text-xs text-slate-500">Add your office&apos;s internet address below.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={f.location} onChange={(e) => setForm({ ...f, location: e.target.checked })} />
          <span>
            Slide button only works at the office (phone location / GPS)
            <span className="block text-xs text-slate-500">Add your office location below. People are asked to allow location when they check in.</span>
          </span>
        </label>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </form>
    </Card>
  );
}

// --- Office networks -----------------------------------------------------------------

function Networks() {
  const list = useApi<OfficeNetwork[]>("/attendance-devices/networks");
  const [form, setForm] = useState({ name: "", cidr: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card title="Office networks">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The internet address of each office. Tip: open this page from the office Wi-Fi and press <strong>Use my current network</strong>.
        </p>
        <Alert tone="info">
          Most connections in Pakistan get a new address now and then. Ask your provider (PTCL, Nayatel, StormFiber…) for a <strong>static IP</strong>, or
          update it here if staff suddenly can&apos;t check in.
        </Alert>
        {error && <Alert>{error}</Alert>}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {list.data.map((n) => (
              <li key={n.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{n.name}</span> <span className="font-mono text-slate-500">{n.cidr}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${n.name}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={async () => {
                    if (!window.confirm(`Remove ${n.name}?`)) return;
                    await api("DELETE", `/attendance-devices/networks/${n.id}`).catch((e) => setError(errorText(e)));
                    list.reload();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("add");
            setError(null);
            try {
              await api("POST", "/attendance-devices/networks", { name: form.name.trim(), cidr: form.cidr.trim() });
              setForm({ name: "", cidr: "" });
              list.reload();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="Name">
            <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Head office Wi-Fi" />
          </Field>
          <Field label="Internet address">
            <Input required value={form.cidr} onChange={(e) => setForm({ ...form, cidr: e.target.value })} placeholder="39.45.10.20" />
          </Field>
          <Button type="submit" loading={busy === "add"}>
            Add
          </Button>
        </form>
        <Button
          variant="secondary"
          size="sm"
          loading={busy === "ip"}
          onClick={async () => {
            setBusy("ip");
            try {
              const { ip } = await api<{ ip: string }>("GET", "/attendance-devices/my-ip");
              setForm((f) => ({ name: f.name || "Office", cidr: ip }));
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          Use my current network
        </Button>
      </div>
    </Card>
  );
}

// --- Office locations --------------------------------------------------------------------

function Locations() {
  const list = useApi<OfficeLocation[]>("/attendance-devices/locations");
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", radiusMeters: "200" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card title="Office locations (GPS)">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Where each office is, and how far from it people may check in. Easiest: stand in the office with your phone and press{" "}
          <strong>Use my current location</strong>. Or in Google Maps, right-click the building and copy the two numbers.
        </p>
        {error && <Alert>{error}</Alert>}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {list.data.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{o.name}</span>{" "}
                  <span className="text-slate-500">· within {o.radiusMeters} m ·</span>{" "}
                  <a
                    className="text-[#00857a] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                  >
                    see on map
                  </a>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${o.name}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={async () => {
                    if (!window.confirm(`Remove ${o.name}?`)) return;
                    await api("DELETE", `/attendance-devices/locations/${o.id}`).catch((e) => setError(errorText(e)));
                    list.reload();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("add");
            setError(null);
            try {
              await api("POST", "/attendance-devices/locations", {
                name: form.name.trim(),
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                radiusMeters: Number(form.radiusMeters) || 200,
              });
              setForm({ name: "", latitude: "", longitude: "", radiusMeters: "200" });
              list.reload();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="Name">
            <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lahore office" />
          </Field>
          <Field label="Allowed distance (metres)" hint="200 m suits most buildings">
            <Input type="number" min={25} max={5000} value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} />
          </Field>
          <Field label="Latitude">
            <Input required inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="31.5204" />
          </Field>
          <Field label="Longitude">
            <Input required inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="74.3587" />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" loading={busy === "add"}>
              Add location
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "gps"}
              onClick={async () => {
                setBusy("gps");
                setError(null);
                try {
                  const p = await currentLocation();
                  setForm((f) => ({ ...f, name: f.name || "Office", latitude: p.latitude.toFixed(6), longitude: p.longitude.toFixed(6) }));
                } catch (err) {
                  setError(errorText(err));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Use my current location
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

// --- Machines -------------------------------------------------------------------------------

const KIND_LABEL: Record<DeviceKind, string> = {
  ADMS: "Sends punches itself (ZKTeco / Cloud Server)",
  API: "Another system sends punches (key)",
  IMPORT: "File upload only",
};

function status(d: AttendanceDevice) {
  if (!d.isActive) return <Badge>Switched off</Badge>;
  if (d.kind === "IMPORT") return <Badge>Upload</Badge>;
  if (!d.lastSeenAt) return <Badge tone="yellow">Not connected yet</Badge>;
  const mins = (Date.now() - new Date(d.lastSeenAt).getTime()) / 60000;
  if (d.kind === "ADMS" && mins < 10) return <Badge tone="green">Online</Badge>;
  return <Badge tone={d.kind === "ADMS" ? "red" : "gray"}>Last seen {formatRelative(d.lastSeenAt)}</Badge>;
}

function Machines() {
  const list = useApi<AttendanceDevice[]>("/attendance-devices");
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState<{ device: AttendanceDevice | { name: string; kind: DeviceKind; serialNumber: string | null }; apiKey: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card
      title="Attendance machines"
      padded={false}
      actions={
        <Button size="sm" onClick={() => setAdding(true)}>
          Add machine
        </Button>
      }
    >
      {error && (
        <div className="p-4 pb-0">
          <Alert>{error}</Alert>
        </div>
      )}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data?.length ? (
        <EmptyState
          title="No machines yet"
          description="Connect a fingerprint/face machine so punches arrive by themselves, or upload files exported from its software."
        />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Machine</Th>
              <Th>Connection</Th>
              <Th>Status</Th>
              <Th>Punches (24 h)</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.map((d) => (
              <tr key={d.id}>
                <Td>
                  <p className="font-medium text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.serialNumber ? `Serial ${d.serialNumber}` : d.apiKeyHint ? `Key …${d.apiKeyHint}` : ""}
                  </p>
                </Td>
                <Td className="text-sm">{KIND_LABEL[d.kind]}</Td>
                <Td>{status(d)}</Td>
                <Td>{d.punchesLast24h}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {d.kind !== "IMPORT" && (
                      <Button size="sm" variant="ghost" onClick={() => setShown({ device: d, apiKey: null })}>
                        Setup
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api("PATCH", `/attendance-devices/${d.id}`, { isActive: !d.isActive }).catch((e) => setError(errorText(e)));
                        list.reload();
                      }}
                    >
                      {d.isActive ? "Switch off" : "Switch on"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!window.confirm(`Remove ${d.name}? Punches it already sent are kept.`)) return;
                        await api("DELETE", `/attendance-devices/${d.id}`).catch((e) => setError(errorText(e)));
                        list.reload();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {adding && (
        <AddMachine
          onClose={() => setAdding(false)}
          onAdded={(device, apiKey) => {
            setAdding(false);
            list.reload();
            if (device.kind !== "IMPORT") setShown({ device, apiKey });
          }}
        />
      )}
      {shown && <SetupHelp device={shown.device} apiKey={shown.apiKey} onClose={() => setShown(null)} onNewKey={list.reload} />}
    </Card>
  );
}

function AddMachine({ onClose, onAdded }: { onClose: () => void; onAdded: (d: { name: string; kind: DeviceKind; serialNumber: string | null; id: string }, apiKey: string | null) => void }) {
  const branches = useApi<Branch[]>("/branches");
  const [form, setForm] = useState({ name: "", kind: "ADMS" as DeviceKind, serialNumber: "", branchId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="Add an attendance machine">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = await api<{ id: string; apiKey: string | null }>("POST", "/attendance-devices", {
              name: form.name.trim(),
              kind: form.kind,
              ...(form.kind === "ADMS" && { serialNumber: form.serialNumber.trim() }),
              ...(form.branchId && { branchId: form.branchId }),
            });
            onAdded({ id: r.id, name: form.name.trim(), kind: form.kind, serialNumber: form.kind === "ADMS" ? form.serialNumber.trim().toUpperCase() : null }, r.apiKey);
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Name">
          <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front door machine" />
        </Field>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">How does it connect?</legend>
          {(
            [
              ["ADMS", "The machine sends punches itself", "ZKTeco and most machines with a “Cloud Server”, “ADMS” or “Push” setting. Needs the office internet."],
              ["API", "Another system sends punches", "For other brands or your IT team’s software. You get a secret key."],
              ["IMPORT", "I'll upload files", "Export the attendance log from the machine’s software (or USB) and upload it here."],
            ] as const
          ).map(([kind, title, hint]) => (
            <label key={kind} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${form.kind === kind ? "bg-[#e8faf8] ring-[#00857a]" : "ring-slate-200"}`}>
              <input type="radio" name="kind" className="mt-1" checked={form.kind === kind} onChange={() => setForm({ ...form, kind })} />
              <span>
                <span className="block text-sm font-medium text-slate-900">{title}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {form.kind === "ADMS" && (
          <Field label="Serial number" hint="On the sticker at the back, or on the machine: Menu → System Info → Device Info">
            <Input required value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="e.g. CKPG204960123" />
          </Field>
        )}
        <Field label="Branch (optional)" hint="Its clock is read in this branch's timezone">
          <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">—</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Add machine
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800">{value}</code>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Copy this", value);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function SetupHelp({
  device, apiKey: givenKey, onClose, onNewKey,
}: {
  device: { name: string; kind: DeviceKind; serialNumber: string | null; id?: string };
  apiKey: string | null;
  onClose: () => void;
  onNewKey: () => void;
}) {
  const [apiKey, setApiKey] = useState(givenKey);
  const [busy, setBusy] = useState(false);
  const host = API_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const https = API_URL.startsWith("https");
  return (
    <Modal open onClose={onClose} title={`Set up ${device.name}`} wide>
      <div className="space-y-4 text-sm text-slate-700">
        {device.kind === "ADMS" ? (
          <>
            <p>On the machine itself (you&apos;ll need its admin password):</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Open <strong>Menu → Comm. (Communication) → Cloud Server Setting</strong>. On some models it&apos;s called <strong>ADMS</strong> or{" "}
                <strong>Push</strong>.
              </li>
              <li>
                Turn on <strong>Domain name</strong> (if there&apos;s the option) and set <strong>Server address</strong> to:
                <CopyText value={host} />
              </li>
              <li>
                <strong>Server port:</strong> {https ? "443, and turn HTTPS on" : "80"}. Turn the proxy off.
              </li>
              <li>Save and restart the machine. Within a minute or two this machine shows as <strong>Online</strong> here.</li>
              <li>
                Make sure each person&apos;s number on the machine (User ID) is saved as their <strong>Machine ID</strong> on their profile. Punches from IDs
                nobody has yet wait under <strong>Unknown machine IDs</strong> below.
              </li>
            </ol>
            <Alert tone="info">
              Serial number registered here: <strong>{device.serialNumber}</strong>. Machines with a different serial number are refused.
            </Alert>
            <p className="text-xs text-slate-500">
              Older machines without HTTPS support need a plain-HTTP address — tell us your model and we&apos;ll set that up.
            </p>
          </>
        ) : (
          <>
            {apiKey ? (
              <>
                <Alert tone="success">Here is the secret key. Copy it now — for safety it isn&apos;t shown again.</Alert>
                <CopyText value={apiKey} />
              </>
            ) : (
              <p>The key was shown when this connection was created. Lost it? Make a new one (the old one stops working).</p>
            )}
            <p>Give this to your IT team or the machine&apos;s vendor. They send punches to:</p>
            <CopyText value={`POST ${API_URL}/attendance-devices/punches`} />
            <p>with the header <code className="rounded bg-slate-100 px-1">X-Device-Key: &lt;the key&gt;</code> and a body like:</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">{`{
  "punches": [
    { "machineUserId": "12", "time": "2026-10-01 09:02:11" },
    { "machineUserId": "12", "time": "2026-10-01T18:05:00+05:00", "type": "OUT" }
  ]
}`}</pre>
            <p className="text-xs text-slate-500">
              A time without a zone is read as the machine&apos;s local time (the branch or company timezone). Up to 5,000 punches per request; sending
              the same punch twice is harmless.
            </p>
            {device.id && (
              <Button
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={async () => {
                  if (!window.confirm("Make a new key? The old key stops working immediately.")) return;
                  setBusy(true);
                  try {
                    const r = await api<{ apiKey: string }>("POST", `/attendance-devices/${device.id}/new-key`);
                    setApiKey(r.apiKey);
                    onNewKey();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Make a new key
              </Button>
            )}
          </>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Unknown machine IDs -----------------------------------------------------------------

function UnknownIds() {
  const list = useApi<UnmatchedId[]>("/attendance-devices/unmatched");
  const people = useApi<Paginated<Employee>>("/employees?pageSize=100&status=ACTIVE");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  if (!list.data?.length) return null;
  const free = (people.data?.items ?? []).filter((p) => !p.machineUserId);

  return (
    <Card title="Unknown machine IDs" padded={false}>
      <div className="p-4 pb-0 text-sm text-slate-600">
        The machines sent punches for these IDs, but nobody has them yet. Pick who each one is — their earlier punches are added to their attendance.
      </div>
      {msg && (
        <div className="p-4 pb-0">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
      <Table>
        <thead className="bg-slate-50">
          <tr>
            <Th>Machine ID</Th>
            <Th>Punches</Th>
            <Th>Last punch</Th>
            <Th>Who is it?</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.data.map((u) => (
            <tr key={u.machineUserId}>
              <Td className="font-mono font-medium text-slate-900">{u.machineUserId}</Td>
              <Td>{u.punches}</Td>
              <Td>{formatRelative(u.lastAt)}</Td>
              <Td>
                <label className="sr-only" htmlFor={`who-${u.machineUserId}`}>
                  Employee for machine ID {u.machineUserId}
                </label>
                <Select id={`who-${u.machineUserId}`} value={pick[u.machineUserId] ?? ""} onChange={(e) => setPick({ ...pick, [u.machineUserId]: e.target.value })}>
                  <option value="">Choose…</option>
                  {free.map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)} · {p.employeeNumber}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    disabled={!pick[u.machineUserId]}
                    loading={busy === u.machineUserId}
                    onClick={async () => {
                      setBusy(u.machineUserId);
                      setMsg(null);
                      try {
                        const r = await api<{ linked: number }>("POST", `/attendance-devices/unmatched/${encodeURIComponent(u.machineUserId)}/link`, {
                          employeeId: pick[u.machineUserId],
                        });
                        setMsg({ tone: "success", text: `Linked — ${r.linked} punch${r.linked === 1 ? "" : "es"} added to their attendance.` });
                        list.reload();
                        people.reload();
                      } catch (err) {
                        setMsg({ tone: "error", text: errorText(err) });
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm(`Delete the ${u.punches} punches from ID ${u.machineUserId}? (e.g. a test or someone who left)`)) return;
                      await api("DELETE", `/attendance-devices/unmatched/${encodeURIComponent(u.machineUserId)}`);
                      list.reload();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

// --- Import a file -------------------------------------------------------------------------

const CHUNK = 2000;

function ImportFile() {
  const devices = useApi<AttendanceDevice[]>("/attendance-devices");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [cols, setCols] = useState({ id: 0, date: 1, time: -1 });
  const [order, setOrder] = useState<DateOrder>("DMY");
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const body = useMemo(() => (rows ? rows.slice(hasHeader ? 1 : 0) : []), [rows, hasHeader]);
  const headers = rows?.[0] ?? [];
  const width = Math.max(0, ...(rows ?? []).slice(0, 20).map((r) => r.length));
  const colName = (i: number) => (hasHeader && headers[i] ? `${headers[i]} (column ${i + 1})` : `Column ${i + 1}`);
  const punches = useMemo(
    () =>
      body.map((r) => ({
        machineUserId: (r[cols.id] ?? "").trim(),
        time: readDateTime(r[cols.date] ?? "", cols.time >= 0 ? r[cols.time] : undefined, order),
      })),
    [body, cols, order],
  );
  const good = punches.filter((p) => p.machineUserId && p.time) as { machineUserId: string; time: string }[];

  async function onFile(file: File) {
    setResult(null);
    setError(null);
    if (file.size > 20 * 1024 * 1024) return setError("That file is over 20 MB — export a shorter date range.");
    if (/\.xlsx?$/i.test(file.name)) return setError("Excel files: open it in Excel and choose File → Save As → CSV, then upload the CSV.");
    const text = await file.text();
    const parsed = parseRows(text, detectDelimiter(text));
    if (!parsed.length) return setError("That file looks empty.");
    setFileName(file.name);
    setRows(parsed);
    // Guess: a header row has letters in every cell; ZKTeco attlog.dat is "ID  date time  …".
    const first = parsed[0];
    const header = first.every((c) => /[A-Za-z]/.test(c));
    setHasHeader(header);
    const sample = parsed.slice(header ? 1 : 0, 30);
    const dateCol = Math.max(0, first.findIndex((_, i) => sample.some((r) => /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(r[i] ?? ""))));
    const timeInSame = sample.some((r) => /\d{1,2}:\d{2}/.test(r[dateCol] ?? ""));
    const timeCol = timeInSame ? -1 : first.findIndex((_, i) => i !== dateCol && sample.some((r) => /^\d{1,2}:\d{2}/.test(r[i] ?? "")));
    const idCol = first.findIndex((_, i) => i !== dateCol && i !== timeCol && sample.every((r) => /^[A-Za-z0-9_-]{1,40}$/.test((r[i] ?? "").trim())));
    setCols({ id: Math.max(0, idCol), date: dateCol, time: timeCol });
    setOrder(guessOrder(sample.map((r) => r[dateCol] ?? "")));
  }

  async function send() {
    setBusy(true);
    setError(null);
    const total: PunchResult = { received: 0, saved: 0, matched: 0, skipped: 0, unknownIds: [] };
    try {
      for (let i = 0; i < good.length; i += CHUNK) {
        const r = await api<PunchResult>("POST", "/attendance-devices/import", {
          ...(deviceId && { deviceId }),
          punches: good.slice(i, i + CHUNK),
        });
        total.received += r.received;
        total.saved += r.saved;
        total.matched += r.matched;
        total.skipped += r.skipped;
        total.unknownIds = [...new Set([...total.unknownIds, ...r.unknownIds])];
      }
      setResult({ ...total, skipped: total.skipped + (punches.length - good.length) });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Upload a file from a machine">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          For machines that aren&apos;t connected: export the attendance log from its software (ZKTime, ZKBioTime…) as <strong>CSV</strong>, or copy the{" "}
          <strong>attlog.dat</strong> file from its USB stick, and upload it. Uploading the same file twice is harmless.
        </p>
        {error && <Alert>{error}</Alert>}
        {result && (
          <Alert tone="success">
            {result.saved} new punch{result.saved === 1 ? "" : "es"} added ({result.matched} matched to employees)
            {result.received - result.saved > 0 && `, ${result.received - result.saved} were already here`}
            {result.skipped > 0 && `, ${result.skipped} rows couldn't be read`}.
            {result.unknownIds.length > 0 && ` Unknown IDs: ${result.unknownIds.slice(0, 10).join(", ")}${result.unknownIds.length > 10 ? "…" : ""} — link them under Unknown machine IDs.`}
          </Alert>
        )}
        <Field label="File (CSV, TXT or DAT)">
          <Input type="file" accept=".csv,.txt,.dat,.tsv,text/csv,text/plain" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </Field>
        {rows && (
          <>
            <p className="text-xs text-slate-500">
              {fileName}: {body.length} rows. Check the columns — the preview below should show the right people and times.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              The first row is column names
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Machine ID column">
                <Select value={String(cols.id)} onChange={(e) => setCols({ ...cols, id: Number(e.target.value) })}>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {colName(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date (and time) column">
                <Select value={String(cols.date)} onChange={(e) => setCols({ ...cols, date: Number(e.target.value) })}>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {colName(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Time column">
                <Select value={String(cols.time)} onChange={(e) => setCols({ ...cols, time: Number(e.target.value) })}>
                  <option value="-1">Same column as the date</option>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {colName(i)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dates are written as">
                <Select value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
                  <option value="DMY">Day/Month/Year (26/09/2026)</option>
                  <option value="MDY">Month/Day/Year (09/26/2026)</option>
                  <option value="YMD">Year-Month-Day (2026-09-26)</option>
                </Select>
              </Field>
            </div>
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Machine ID</th>
                    <th className="px-3 py-2">Punch time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {punches.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{p.machineUserId || "—"}</td>
                      <td className={`px-3 py-2 ${p.time ? "" : "text-red-600"}`}>{p.time ?? "can't read this date/time"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56">
                <Field label="Which machine (optional)">
                  <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                    <option value="">—</option>
                    {devices.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button onClick={send} loading={busy} disabled={!good.length}>
                Upload {good.length} punch{good.length === 1 ? "" : "es"}
              </Button>
              {punches.length - good.length > 0 && <span className="text-xs text-amber-700">{punches.length - good.length} rows can&apos;t be read and will be skipped</span>}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
