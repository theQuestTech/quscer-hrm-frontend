"use client";

import { useState } from "react";
import { type TeamMember, supportApi, useSupport, useSupportApi } from "@/lib/support";
import { formatRelative } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner, Table, Td, Th } from "@/components/ui";

export default function TeamPage() {
  const { agent } = useSupport();
  const team = useSupportApi<TeamMember[]>("/support/team");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owner = !!agent?.isOwner;

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
        description={owner ? "People who can open this console." : "People who can open this console. Only the owner can change the team."}
        actions={owner ? <Button onClick={() => setAdding(true)}>Add someone</Button> : undefined}
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
                    {!m.isActive ? <Badge>Switched off</Badge> : m.hasPassword ? <Badge tone="green">Active</Badge> : <Badge tone="yellow">Invited</Badge>}
                  </Td>
                  <Td className="text-right">
                    {owner && m.id !== agent?.id && (
                      <Button size="sm" variant="ghost" loading={busy === m.id} onClick={() => toggle(m)}>
                        {m.isActive ? "Switch off" : "Switch on"}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
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
