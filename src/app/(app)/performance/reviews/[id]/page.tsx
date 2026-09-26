"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, fullName } from "@/lib/format";
import type { KpiMeasure, KpiTemplate, ReviewDetail, ReviewKpi } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, Table, Td, Textarea, Th } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";
import { RatingPicker, ScoreText, StageBadge, StageSteps } from "@/components/performance";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const review = useApi<ReviewDetail>(`/performance/reviews/${id}`);

  if (review.loading && !review.data) return <Spinner />;
  if (review.error) return <Alert>{review.error}</Alert>;
  const r = review.data;
  if (!r) return null;
  const closed = r.cycle.status === "CLOSED";

  return (
    <>
      <Link href="/performance" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Performance
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar
            person={r.employee}
            size={56}
            photo={r.employee.photoUpdatedAt ? { employeeId: r.employee.id, updatedAt: r.employee.photoUpdatedAt } : null}
          />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{fullName(r.employee)}</h1>
            <p className="text-sm text-slate-500">
              {r.employee.designation} · {r.cycle.name} ({formatDate(r.cycle.periodStart)} – {formatDate(r.cycle.periodEnd)})
            </p>
            <p className="text-sm text-slate-500">Reviewer: {r.reviewer ? fullName(r.reviewer) : "HR"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {closed && r.stage !== "DONE" && <Badge tone="red">Cycle closed</Badge>}
          <StageBadge stage={r.stage} />
        </div>
      </div>
      <div className="mb-6">
        <StageSteps stage={r.stage} selfReview={r.settings.selfReview} />
      </div>
      <Summary review={r} onChange={review.reload} />
      {r.can.setGoals ? <GoalsEditor review={r} onChange={review.reload} /> : <Ratings review={r} onChange={review.reload} />}
    </>
  );
}

function Summary({ review: r, onChange }: { review: ReviewDetail; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = waitingText(r);

  async function acknowledge() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/performance/reviews/${r.id}/acknowledge`);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <Card>
        <p className="text-sm text-slate-500">{r.finalScore !== null ? "Final score" : "Score so far"}</p>
        <p className="mt-1 text-2xl">
          <ScoreText score={r.finalScore ?? r.previewScore} band={r.finalScore !== null ? r.band : null} />
        </p>
        {r.finalScore === null && r.previewScore !== null && <p className="mt-1 text-xs text-slate-500">Preview — changes until the review is complete.</p>}
      </Card>
      <div className="md:col-span-2">
        <Card>
          <div className="space-y-3">
            {error && <Alert>{error}</Alert>}
            {waiting && <p className="text-sm text-slate-700">{waiting}</p>}
            {r.completedAt && <p className="text-sm text-slate-500">Completed on {formatDate(r.completedAt)}.</p>}
            {r.acknowledgedAt && <p className="text-sm text-slate-500">Seen by the employee on {formatDate(r.acknowledgedAt)}.</p>}
            {r.can.acknowledge && (
              <Button onClick={acknowledge} loading={busy}>
                I have read my review
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function waitingText(r: ReviewDetail): string | null {
  if (r.cycle.status === "CLOSED" && r.stage !== "DONE") return "This cycle was closed before the review was finished.";
  if (r.can.setGoals) return "Set the goals for this person, then share them.";
  if (r.can.selfReview) return "Rate yourself on each goal, then submit. Your manager sees it after you submit.";
  if (r.can.managerReview) return "Rate each goal and fill in the actual results, then complete the review.";
  if (r.can.acknowledge) return "Your review is complete. Please read it and confirm.";
  if (r.stage === "GOALS") return "Waiting for the manager to set goals.";
  if (r.stage === "SELF") return "Waiting for the employee's self-review.";
  if (r.stage === "MANAGER") return "Waiting for the manager's review.";
  return null;
}

// --- Goals (manager, before sharing) ----------------------------------------

type Goal = {
  key: string;
  name: string;
  measure: KpiMeasure;
  unit: string;
  target: string;
  weight: string;
  higherIsBetter: boolean;
  auto: "ATTENDANCE" | null;
};

let goalKey = 0;
const toGoal = (k: Pick<ReviewKpi, "name" | "measure" | "unit" | "target" | "weight" | "higherIsBetter" | "auto">): Goal => ({
  key: `g${goalKey++}`,
  name: k.name,
  measure: k.measure,
  unit: k.unit ?? "",
  target: k.target === null ? "" : String(k.target),
  weight: String(k.weight),
  higherIsBetter: k.higherIsBetter,
  auto: k.auto,
});

function GoalsEditor({ review: r, onChange }: { review: ReviewDetail; onChange: () => void }) {
  const templates = useApi<KpiTemplate[]>("/performance/kpis");
  const [goals, setGoals] = useState<Goal[]>(() => r.kpis.map(toGoal));
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const scoring = r.settings.scoring;
  const measures: KpiMeasure[] = scoring === "BOTH" ? ["RATING", "TARGET"] : [scoring];
  const total = goals.reduce((s, g) => s + (Number(g.weight) || 0), 0);

  function update(key: string, patch: Partial<Goal>) {
    setGoals((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
    setDirty(true);
  }

  function add(templateId: string) {
    const t = templates.data?.find((x) => x.id === templateId);
    const base = t
      ? { name: t.name, measure: t.measure, unit: t.unit, target: t.defaultTarget, weight: t.defaultWeight, higherIsBetter: t.higherIsBetter, auto: t.auto }
      : { name: "", measure: measures[0], unit: null, target: null, weight: 0, higherIsBetter: true, auto: null };
    setGoals((gs) => [...gs, toGoal(base)]);
    setDirty(true);
    setPick("");
  }

  async function save(): Promise<boolean> {
    setBusy("save");
    setMessage(null);
    try {
      await api("PUT", `/performance/reviews/${r.id}/goals`, {
        kpis: goals.map((g) => ({
          name: g.name.trim(),
          measure: g.auto ? "TARGET" : g.measure,
          unit: g.unit.trim() || undefined,
          target: g.target === "" ? null : Number(g.target),
          weight: Number(g.weight) || 0,
          higherIsBetter: g.higherIsBetter,
          auto: g.auto,
        })),
      });
      setDirty(false);
      setMessage({ tone: "success", text: "Goals saved." });
      return true;
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (dirty && !(await save())) return;
    if (!window.confirm("Share these goals? You can't change them after this.")) return;
    setBusy("share");
    setMessage(null);
    try {
      await api("POST", `/performance/reviews/${r.id}/share`);
      onChange();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not share" });
      setBusy(null);
    }
  }

  return (
    <Card title="Goals">
      <div className="space-y-4">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {goals.length === 0 && <p className="text-sm text-slate-500">No goals yet. Add one from the KPI list or write your own.</p>}
        {goals.map((g, i) => (
          <fieldset key={g.key} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-500">Goal {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <Field label="Name">
                  <Input value={g.name} onChange={(e) => update(g.key, { name: e.target.value })} />
                </Field>
              </div>
              <Field label="How it's measured">
                <Select
                  value={g.auto ? "AUTO" : g.measure}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "AUTO") update(g.key, { auto: "ATTENDANCE", measure: "TARGET", unit: "%", target: g.target || "95", higherIsBetter: true });
                    else update(g.key, { auto: null, measure: v as KpiMeasure });
                  }}
                >
                  {measures.includes("RATING") && <option value="RATING">Rating 1–5</option>}
                  {measures.includes("TARGET") && <option value="TARGET">Target number</option>}
                  {measures.includes("TARGET") && <option value="AUTO">Punctuality from attendance</option>}
                </Select>
              </Field>
              {g.measure === "TARGET" || g.auto ? (
                <>
                  <Field label={g.auto ? "Target (%)" : "Target"}>
                    <Input type="number" inputMode="decimal" value={g.target} onChange={(e) => update(g.key, { target: e.target.value })} />
                  </Field>
                  <Field label="Unit">
                    <Input value={g.unit} disabled={!!g.auto} placeholder="e.g. sales, %" onChange={(e) => update(g.key, { unit: e.target.value })} />
                  </Field>
                </>
              ) : (
                <div className="hidden lg:col-span-2 lg:block" />
              )}
              <Field label="Weight (%)">
                <Input type="number" inputMode="numeric" min={1} max={100} value={g.weight} onChange={(e) => update(g.key, { weight: e.target.value })} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {g.measure === "TARGET" && !g.auto ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!g.higherIsBetter} onChange={(e) => update(g.key, { higherIsBetter: !e.target.checked })} />
                  Lower is better (e.g. complaints, errors)
                </label>
              ) : (
                <span />
              )}
              <Button variant="ghost" size="sm" onClick={() => (setGoals((gs) => gs.filter((x) => x.key !== g.key)), setDirty(true))}>
                Remove
              </Button>
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Add a goal">
              <Select value={pick} onChange={(e) => (e.target.value ? add(e.target.value) : undefined)}>
                <option value="">Choose from the KPI list…</option>
                {(templates.data ?? [])
                  .filter((t) => t.isActive && measures.includes(t.measure))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Button variant="secondary" onClick={() => add("")}>
            Write my own
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className={total === 100 ? "text-sm text-slate-600" : "text-sm font-medium text-amber-700"} role="status">
            Weights add up to {total}%{total !== 100 && " — they must add up to 100%"}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save} loading={busy === "save"} disabled={goals.length === 0}>
              Save goals
            </Button>
            <Button onClick={share} loading={busy === "share"} disabled={goals.length === 0 || total !== 100}>
              Share with employee
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Ratings (self or manager) ---------------------------------------------

type Entry = { rating: number | null; actual: string; note: string };

function Ratings({ review: r, onChange }: { review: ReviewDetail; onChange: () => void }) {
  const side: "self" | "manager" | null = r.can.selfReview ? "self" : r.can.managerReview ? "manager" : null;
  const initial = () =>
    Object.fromEntries(
      r.kpis.map((k) => [
        k.id,
        {
          rating: side === "self" ? k.selfRating : k.managerRating,
          actual: k.actual === null ? "" : String(k.actual),
          note: (side === "self" ? k.selfNote : k.managerNote) ?? "",
        },
      ]),
    ) as Record<string, Entry>;
  const [entries, setEntries] = useState<Record<string, Entry>>(initial);
  const [comment, setComment] = useState((side === "self" ? r.selfComment : r.managerComment) ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  // Fresh data after a save or stage change resets the form.
  useEffect(() => {
    setEntries(initial());
    setComment((side === "self" ? r.selfComment : r.managerComment) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const set = (id: string, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  async function run(name: string, finish?: string) {
    if (name === "complete" && !window.confirm("Complete this review? The score becomes final and the employee can see it.")) return;
    setBusy(name);
    setMessage(null);
    try {
      const body = {
        kpis: r.kpis.map((k) => {
          const e = entries[k.id];
          return {
            id: k.id,
            ...(k.measure === "RATING" && e.rating !== null && { rating: e.rating }),
            ...(k.measure === "TARGET" && !k.auto && { actual: e.actual === "" ? null : Number(e.actual) }),
            note: e.note.trim() || null,
          };
        }),
        comment: comment.trim() || null,
      };
      if (finish) await api("POST", `/performance/reviews/${r.id}/${finish}`, body);
      else await api("PATCH", `/performance/reviews/${r.id}/${side}`, body);
      setMessage(finish ? null : { tone: "success", text: "Saved." });
      onChange();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusy(null);
    }
  }

  if (r.kpis.length === 0) {
    return (
      <Card title="Goals">
        <p className="text-sm text-slate-500">No goals have been set yet.</p>
      </Card>
    );
  }

  const showSelf = r.settings.selfReview;
  return (
    <div className="space-y-6">
      <Card title="Goals and ratings" padded={false}>
        {message && (
          <div className="p-4 pb-0">
            <Alert tone={message.tone}>{message.text}</Alert>
          </div>
        )}
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>Goal</Th>
              <Th>Weight</Th>
              <Th>Target / actual</Th>
              {showSelf && <Th>Self rating</Th>}
              <Th>Manager rating</Th>
              <Th>Score</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.kpis.map((k) => {
              const e = entries[k.id];
              return (
                <tr key={k.id} className="align-top">
                  <Td>
                    <p className="font-medium text-slate-900">{k.name}</p>
                    <p className="text-xs text-slate-500">
                      {k.auto ? "Filled from attendance" : k.measure === "RATING" ? "Rated 1–5" : k.higherIsBetter ? "Higher is better" : "Lower is better"}
                    </p>
                    {side && e && (
                      <div className="mt-2">
                        <label className="sr-only" htmlFor={`note-${k.id}`}>
                          Note for {k.name}
                        </label>
                        <Input id={`note-${k.id}`} placeholder="Add a note (optional)" value={e.note} onChange={(ev) => set(k.id, { note: ev.target.value })} />
                      </div>
                    )}
                    {side !== "self" && k.selfNote && <p className="mt-2 text-xs text-slate-600">Employee: “{k.selfNote}”</p>}
                    {side !== "manager" && k.managerNote && <p className="mt-2 text-xs text-slate-600">Manager: “{k.managerNote}”</p>}
                  </Td>
                  <Td>{k.weight}%</Td>
                  <Td>
                    {k.measure === "RATING" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">
                          Target {k.target}
                          {k.unit ? ` ${k.unit}` : ""}
                        </p>
                        {side && !k.auto && e ? (
                          <>
                            <label className="sr-only" htmlFor={`actual-${k.id}`}>
                              Actual for {k.name}
                            </label>
                            <Input
                              id={`actual-${k.id}`}
                              type="number"
                              inputMode="decimal"
                              className="w-28"
                              placeholder="Actual"
                              value={e.actual}
                              onChange={(ev) => set(k.id, { actual: ev.target.value })}
                            />
                          </>
                        ) : (
                          <p className="text-sm text-slate-900">
                            {k.actual === null ? (k.auto ? "Filled when submitted" : "—") : `Actual ${k.actual}${k.unit ? ` ${k.unit}` : ""}`}
                          </p>
                        )}
                      </div>
                    )}
                  </Td>
                  {showSelf && (
                    <Td>
                      {k.measure !== "RATING" ? (
                        <span className="text-slate-400">—</span>
                      ) : side === "self" && e ? (
                        <RatingPicker label={`Your rating for ${k.name}`} value={e.rating} onChange={(v) => set(k.id, { rating: v })} />
                      ) : (
                        <RatingText value={k.selfRating} />
                      )}
                    </Td>
                  )}
                  <Td>
                    {k.measure !== "RATING" ? (
                      <span className="text-slate-400">—</span>
                    ) : side === "manager" && e ? (
                      <RatingPicker label={`Manager rating for ${k.name}`} value={e.rating} onChange={(v) => set(k.id, { rating: v })} />
                    ) : (
                      <RatingText value={k.managerRating} hidden={side === "self" || (r.stage !== "DONE" && k.managerRating === null)} />
                    )}
                  </Td>
                  <Td>
                    <ScoreText score={k.score} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {showSelf && (
          <Card title="Employee's comments">
            {side === "self" ? (
              <Field label="Anything you want your manager to know">
                <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
              </Field>
            ) : (
              <p className="whitespace-pre-line text-sm text-slate-700">{r.selfComment || <span className="text-slate-400">No comments.</span>}</p>
            )}
          </Card>
        )}
        <Card title="Manager's comments">
          {side === "manager" ? (
            <Field label="Summary for the employee">
              <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          ) : (
            <p className="whitespace-pre-line text-sm text-slate-700">
              {r.managerComment || <span className="text-slate-400">{r.stage === "DONE" ? "No comments." : "Shown when the review is complete."}</span>}
            </p>
          )}
        </Card>
      </div>
      {side && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => run("save")} loading={busy === "save"}>
            Save draft
          </Button>
          {side === "self" ? (
            <Button onClick={() => run("submit", "self/submit")} loading={busy === "submit"}>
              Submit self-review
            </Button>
          ) : (
            <Button onClick={() => run("complete", "complete")} loading={busy === "complete"}>
              Complete review
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RatingText({ value, hidden }: { value: number | null; hidden?: boolean }) {
  if (value === null) return <span className="text-slate-400">{hidden ? "Hidden until done" : "—"}</span>;
  return <span className="font-medium text-slate-900">{value} / 5</span>;
}
