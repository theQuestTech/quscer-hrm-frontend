"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Alert, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Table, Td, Th } from "@/components/ui";

// A settings list (branches, departments, shifts…) with add / edit / delete
// driven by a field config, so each list only describes its columns.

export interface CrudField {
  key: string;
  label: string;
  type?: "text" | "time" | "date" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string | boolean;
}

type Row = { id: string } & Record<string, unknown>;

export function CrudList<T extends Row>({
  title,
  description,
  path,
  fields,
  columns,
  canEdit = true,
  canDelete = true,
  itemName,
}: {
  title: string;
  description?: string;
  path: string;
  fields: CrudField[];
  columns: { label: string; render: (row: T) => React.ReactNode }[];
  canEdit?: boolean;
  canDelete?: boolean;
  itemName: string;
}) {
  const list = useApi<T[]>(path);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function open(row: T | "new") {
    const initial: Record<string, string | boolean> = {};
    for (const f of fields) {
      const current = row === "new" ? undefined : row[f.key];
      if (f.type === "checkbox") initial[f.key] = current === undefined ? (f.defaultValue ?? false) : Boolean(current);
      else if (f.type === "date" && typeof current === "string") initial[f.key] = current.slice(0, 10);
      else initial[f.key] = current === undefined || current === null ? String(f.defaultValue ?? "") : String(current);
    }
    setValues(initial);
    setError(null);
    setEditing(row);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.type === "checkbox") payload[f.key] = v;
      else if (v === "" || v === undefined) continue;
      else if (f.type === "number") payload[f.key] = Number(v);
      else payload[f.key] = v;
    }
    try {
      if (editing === "new") await api("POST", path, payload);
      else if (editing) await api("PATCH", `${path}/${editing.id}`, payload);
      setEditing(null);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: T) {
    if (!window.confirm(`Delete this ${itemName}?`)) return;
    setListError(null);
    try {
      await api("DELETE", `${path}/${row.id}`);
      list.reload();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <Card
      title={title}
      padded={false}
      actions={
        <Button size="sm" onClick={() => open("new")}>
          <Plus className="size-4" /> Add {itemName}
        </Button>
      }
    >
      {description && <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">{description}</p>}
      {(listError || list.error) && (
        <div className="p-4">
          <Alert>{listError ?? list.error}</Alert>
        </div>
      )}
      {list.loading && !list.data ? (
        <Spinner />
      ) : !list.data?.length ? (
        <EmptyState title={`No ${itemName}s yet`} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <Th key={c.label}>{c.label}</Th>
              ))}
              {(canEdit || canDelete) && <Th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <Td key={c.label}>{c.render(row)}</Td>
                ))}
                {(canEdit || canDelete) && (
                  <Td className="text-right">
                    {canEdit && (
                      <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => open(row)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove(row)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? `Add ${itemName}` : `Edit ${itemName}`}>
        <form onSubmit={save} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ) : (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.type === "select" ? (
                  <Select required={f.required} value={String(values[f.key] ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                    {!f.required && <option value="">—</option>}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    min={f.type === "number" ? 0 : undefined}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
              </Field>
            ),
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
