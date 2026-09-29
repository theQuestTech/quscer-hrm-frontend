"use client";

import { useState } from "react";
import { type TeamMember, supportApi, useSupport, useSupportApi } from "@/lib/support";
import { formatRelative } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner, Table, Td, Th } from "@/components/ui";
import { BackupCodes } from "@/components/two-step";

export default function TeamPage() {
  const { agent, refresh } = useSupport();
  const [renaming, setRenaming] = useState<TeamMember | null>(null);
  const team = useSupportApi<TeamMember[]>("/support/team");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const owner = !!agent?.isOwner;

  // Both ask for the code from your phone first ("Confirm it's you").
  async function resetTwoStep(m: TeamMember) {
    if (!window.confirm(`Reset ${m.name}'s two-step sign-in? Use this if they lost their phone and backup codes. They'll set it up again with a new QR code.`)) return;
    setBusy(`2s-${m.id}`);
    setError(null);
    try {
      await supportApi("POST", `/support/team/${m.id}/reset-two-step`);
      await team.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset");
    } finally {
      setBusy(null);
    }
  }

  async function newBackupCodes() {
    setBusy("codes");
    setError(null);
    try {
      setBackupCodes((await supportApi<{ backupCodes: string[] }>("POST", "/support/two-step/backup-codes")).backupCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make new codes");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(m: TeamMember) {
    if (m.isActive && !window.confirm(`Switch off ${m.name}'s support account? They're signed out at once.`)) return;
    setBusy(m.id);
    setError(null);
    try {
      await supportApi("PATCH", `/support/team/${m.id}`, { isActive: !m.isActive });
      await team.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Support team"
        description={`People who can open this console. Customers see your name on anything you do for them, e.g. “${agent?.name ?? "Ali"} (Quscer support)”.${owner ? "" : " Only the owner can add or remove people."}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy === "codes"} onClick={newBackupCodes}>
              New backup codes
            </Button>
            {owner && <Button onClick={() => setAdding(true)}>Add someone</Button>}
          </div>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <Card padded={false}>
        {team.loading && !team.data ? (
          <Spinner />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Name</Th>
                <Th>Last sign-in</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.data?.map((m) => (
                <tr key={m.id} className={m.isActive ? undefined : "opacity-60"}>
                  <Td>
                    <p className="font-medium text-slate-900">
                      {m.name} {m.isOwner && <Badge tone="blue">Owner</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </Td>
                  <Td>{m.lastLoginAt ? formatRelative(m.lastLoginAt) : "Never"}</Td>
                  <Td>
                    {!m.isActive ? <Badge>Switched off</Badge> : m.hasPassword ? <Badge tone="green">Active</Badge> : <Badge tone="yellow">Invited</Badge>}{" "}
                    {m.isActive && m.hasPassword && (m.hasTwoStep ? <Badge tone="green">Two-step on</Badge> : <Badge tone="yellow">Two-step not set up</Badge>)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {(owner || m.id === agent?.id) && (
                        <Button size="sm" variant="ghost" onClick={() => setRenaming(m)}>
                          {m.id === agent?.id ? "Change my name" : "Change name"}
                        </Button>
                      )}
                      {owner && m.id !== agent?.id && m.isActive && m.hasTwoStep && (
                        <Button size="sm" variant="ghost" loading={busy === `2s-${m.id}`} onClick={() => resetTwoStep(m)}>
                          Reset two-step
                        </Button>
                      )}
                      {owner && m.id !== agent?.id && (
                        <Button size="sm" variant="ghost" loading={busy === m.id} onClick={() => toggle(m)}>
                          {m.isActive ? "Switch off" : "Switch on"}
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {backupCodes && (
        <Modal open onClose={() => setBackupCodes(null)} title="Your new backup codes">
          <BackupCodes codes={backupCodes} doneLabel="I’ve saved them" onDone={() => setBackupCodes(null)} />
          <p className="mt-3 text-xs text-slate-500">Your old backup codes no longer work.</p>
        </Modal>
      )}
      {renaming && (
        <RenameModal
          member={renaming}
          self={renaming.id === agent?.id}
          onClose={() => setRenaming(null)}
          onDone={async () => {
            setRenaming(null);
            await team.reload();
            await refresh();
          }}
        />
      )}
      {adding && (
        <AddModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            team.reload();
          }}
        />
      )}
    </>
  );
}

function AddModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title="Add someone to the support team">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await supportApi("POST", "/support/team", { name: name.trim(), email: email.trim() });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Name">
          <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Work email" hint="They get an email to choose their password (the link lasts 3 days).">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">They&apos;ll be able to see every company, answer help requests and use the fix-it actions.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Add and send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameModal({ member, self, onClose, onDone }: { member: TeamMember; self: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(member.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={self ? "Change your name" : `Change ${member.name}'s name`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await supportApi("PATCH", `/support/team/${member.id}`, { name: name.trim() });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
            setBusy(false);
          }
        }}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Name" hint={`Customers will see “${name.trim() || "…"} (Quscer support)” on anything ${self ? "you do" : "they do"} from now on.`}>
          <Input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
