"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CommentThread } from "@/components/collaboration/comment-thread";
import {
  MetricBindingField,
  type BindingDraft,
} from "@/components/okr/metric-binding-field";
import { ScoreDialog } from "@/components/okr/score-dialog";
import { TagPicker } from "@/components/okr/tag-picker";
import { useCheckInsForObjective } from "@/hooks/use-check-ins";
import { useObjective } from "@/hooks/use-objectives";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import type { KeyResult } from "@/lib/db/schema";
import { krProgress } from "@/lib/okr/progress";
import { cn } from "@/lib/utils";

type KrType = "number" | "percentage" | "currency" | "milestone";

export function ObjectiveDetailPage({
  objectiveId,
  currentUserId,
  currentRole,
}: {
  objectiveId: string;
  currentUserId: string;
  currentRole: Role;
}) {
  const { detail, isLoading, mutate } = useObjective(objectiveId);
  const router = useRouter();
  const [addingKr, setAddingKr] = useState(false);
  const [editingObj, setEditingObj] = useState(false);

  if (isLoading || !detail) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const { objective, keyResults, parent, children } = detail;
  const isOwner = objective.ownerUserId === currentUserId;
  const canEdit = isOwner || can(currentRole, "team.manage");

  const deleteObjective = async () => {
    if (!confirm("Delete this objective? KRs will be removed too.")) return;
    try {
      await apiSend(`/api/v1/objectives/${objective.id}`, "DELETE");
      router.push("/objectives");
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  return (
    <section className="space-y-6 max-w-4xl">
      <nav className="text-sm text-zinc-500 flex items-center gap-2">
        <Link href="/objectives" className="hover:text-zinc-900 dark:hover:text-zinc-50">
          Objectives
        </Link>
        {parent && (
          <>
            <span>/</span>
            <Link
              href={`/objectives/${parent.id}`}
              className="hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              {parent.title}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-50 truncate">
          {objective.title}
        </span>
      </nav>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{objective.title}</h1>
          {objective.description && (
            <p className="mt-1 text-sm text-zinc-500 whitespace-pre-wrap">
              {objective.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ProgressBar value={Number(objective.progress)} />
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setEditingObj(true)}
                className="text-sm rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={deleteObjective}
                className="text-sm rounded-md border border-red-200 dark:border-red-900 text-red-600 px-2 py-1"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {editingObj && (
        <EditObjectiveDialog
          objective={objective}
          onClose={() => setEditingObj(false)}
          onSaved={() => {
            setEditingObj(false);
            mutate();
          }}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Key Results</h2>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAddingKr(true)}
              className="text-sm rounded-md bg-zinc-900 text-white px-3 py-1.5 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Add KR
            </button>
          )}
        </div>

        {addingKr && (
          <AddKrDialog
            objectiveId={objective.id}
            currentUserId={currentUserId}
            onClose={() => setAddingKr(false)}
            onCreated={() => {
              setAddingKr(false);
              mutate();
            }}
          />
        )}

        <div className="space-y-2">
          {keyResults.length === 0 ? (
            <p className="text-sm text-zinc-500">No key results yet.</p>
          ) : (
            keyResults.map((kr) => (
              <KrCard
                key={kr.id}
                kr={kr}
                canEdit={canEdit || kr.ownerUserId === currentUserId}
                onChange={mutate}
                binding={detail.bindingsByKr?.[kr.id] ?? null}
                score={detail.scoresByKr?.[kr.id] ?? null}
                cycleStatus={detail.cycleStatus}
              />
            ))
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Contributes from</h2>
          <div className="space-y-1 text-sm">
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/objectives/${c.id}`}
                className="block px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                {c.title}
                <span className="text-xs text-zinc-500 ml-2">
                  {Math.round(Number(c.progress))}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <TagPicker entityType="objective" entityId={objective.id} />

      <RecentCheckIns objectiveId={objective.id} />

      <CommentThread
        entityType="objective"
        entityId={objective.id}
        currentUserId={currentUserId}
      />

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">
          Version history
        </summary>
        <VersionHistory objectiveId={objective.id} />
      </details>
    </section>
  );
}

function RecentCheckIns({ objectiveId }: { objectiveId: string }) {
  const { checkIns, isLoading } = useCheckInsForObjective(objectiveId);
  if (isLoading) return null;
  if (checkIns.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Recent check-ins</h2>
      <ol className="space-y-2">
        {checkIns.slice(0, 10).map((ci) => (
          <li
            key={ci.id}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{ci.keyResultTitle}</p>
                <p className="text-xs text-zinc-500">
                  {ci.authorName} ·{" "}
                  {new Date(ci.createdAt).toLocaleDateString()} ·{" "}
                  {Number(ci.previousValue)} → {Number(ci.newValue)}
                </p>
              </div>
              <ConfidenceBadge value={ci.confidence} />
            </div>
            {ci.note && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {ci.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ConfidenceBadge({
  value,
}: {
  value: "on_track" | "at_risk" | "off_track";
}) {
  const map = {
    on_track: {
      label: "On track",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    },
    at_risk: {
      label: "At risk",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    },
    off_track: {
      label: "Off track",
      cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    },
  } as const;
  const { label, cls } = map[value];
  return (
    <span className={cn("text-xs rounded-full px-2 py-0.5", cls)}>
      {label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value);
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="h-2 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm tabular-nums">{pct}%</span>
    </div>
  );
}

function formatValue(kr: KeyResult): string {
  const current = Number(kr.currentValue);
  const target = Number(kr.targetValue);
  const unit = kr.unit ?? "";
  if (kr.krType === "currency") {
    return `$${current.toLocaleString()} / $${target.toLocaleString()}`;
  }
  if (kr.krType === "percentage") {
    return `${current}% / ${target}%`;
  }
  if (kr.krType === "milestone") {
    return current >= 100 ? "Done" : "Pending";
  }
  return `${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`.trim();
}

function KrCard({
  kr,
  canEdit,
  onChange,
  binding,
  score,
  cycleStatus,
}: {
  kr: KeyResult;
  canEdit: boolean;
  onChange: () => void;
  binding: { provider: string; metricLabel: string } | null;
  score: { score: string; finalValue: string; reflection: string } | null;
  cycleStatus: "planning" | "active" | "grading" | "closed" | null;
}) {
  const [editing, setEditing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const pct = Math.round(krProgress(kr));
  const gradingOpen =
    cycleStatus === "grading" || cycleStatus === "closed";

  const del = async () => {
    if (!confirm("Delete this KR?")) return;
    try {
      await apiSend(`/api/v1/key-results/${kr.id}`, "DELETE");
      onChange();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{kr.title}</p>
            {binding && (
              <span
                title={binding.metricLabel}
                className="text-xs rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5"
              >
                auto · {binding.provider}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{formatValue(kr)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums">{pct}%</span>
          </div>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={del}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {(gradingOpen || score) && (
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3">
          {score ? (
            <div className="flex-1 min-w-0">
              <p className="text-xs">
                <span className="font-medium">
                  Scored {Number(score.score).toFixed(2)}
                </span>
                <span className="text-zinc-500 ml-2">
                  final {Number(score.finalValue)}
                </span>
              </p>
              {score.reflection && (
                <p className="text-xs text-zinc-500 mt-1 italic line-clamp-2">
                  “{score.reflection}”
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Not yet scored — cycle is in grading.
            </p>
          )}
          {canEdit && gradingOpen && (
            <button
              type="button"
              onClick={() => setScoring(true)}
              className="text-xs rounded-md bg-zinc-900 text-white px-2 py-1 dark:bg-zinc-50 dark:text-zinc-900 shrink-0"
            >
              {score ? "Update score" : "Score"}
            </button>
          )}
        </div>
      )}
      {editing && (
        <EditKrDialog
          kr={kr}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChange();
          }}
        />
      )}
      {scoring && (
        <ScoreDialog
          keyResultId={kr.id}
          krTitle={kr.title}
          currentValue={kr.currentValue}
          targetValue={kr.targetValue}
          existing={score}
          onClose={() => setScoring(false)}
          onSaved={() => {
            setScoring(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function AddKrDialog({
  objectiveId,
  currentUserId,
  onClose,
  onCreated,
}: {
  objectiveId: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [krType, setKrType] = useState<KrType>("number");
  const [startValue, setStart] = useState("0");
  const [targetValue, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [binding, setBinding] = useState<BindingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await apiSend<{ id: string }>(
        "/api/v1/key-results",
        "POST",
        {
          objectiveId,
          title,
          krType,
          startValue: Number(startValue),
          targetValue: Number(targetValue),
          unit: unit || null,
          ownerUserId: currentUserId,
        },
      );
      if (binding) {
        await apiSend("/api/v1/metrics/bindings", "POST", {
          keyResultId: created.id,
          integrationConnectedId: binding.integrationConnectedId,
          metricDefinitionId: binding.metricDefinitionId,
          config: binding.config,
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Add Key Result</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Type</span>
            <select
              value={krType}
              onChange={(e) => setKrType(e.target.value as KrType)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="number">Number</option>
              <option value="percentage">Percentage</option>
              <option value="currency">Currency ($)</option>
              <option value="milestone">Milestone (done/pending)</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Unit</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={krType === "number" ? "e.g. users" : ""}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              disabled={krType === "milestone"}
            />
          </label>
          {krType !== "milestone" && (
            <>
              <label className="text-sm space-y-1">
                <span className="text-zinc-700 dark:text-zinc-300">Start</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={startValue}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-zinc-700 dark:text-zinc-300">Target</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={targetValue}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          {krType === "milestone" && (
            <input type="hidden" value="100" readOnly />
          )}
        </div>
        <MetricBindingField value={binding} onChange={setBinding} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={(e) => {
              if (krType === "milestone") {
                setStart("0");
                setTarget("100");
              }
              void e;
            }}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditKrDialog({
  kr,
  onClose,
  onSaved,
}: {
  kr: KeyResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(kr.title);
  const [targetValue, setTarget] = useState(kr.targetValue);
  const [currentValue, setCurrent] = useState(kr.currentValue);
  const [editReason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetChanged = targetValue !== kr.targetValue;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/key-results/${kr.id}`, "PATCH", {
        title,
        targetValue: Number(targetValue),
        currentValue: Number(currentValue),
        ...(targetChanged && editReason ? { editReason } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Edit Key Result</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Current</span>
            <input
              type="number"
              step="any"
              value={currentValue}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Target</span>
            <input
              type="number"
              step="any"
              value={targetValue}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
          </label>
        </div>
        {targetChanged && (
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">
              Why is the target changing?
            </span>
            <textarea
              required
              value={editReason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Required during active cycles"
            />
          </label>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditObjectiveDialog({
  objective,
  onClose,
  onSaved,
}: {
  objective: { id: string; title: string; description: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description ?? "");
  const [editReason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    title !== objective.title || description !== (objective.description ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/objectives/${objective.id}`, "PATCH", {
        title,
        description: description || null,
        ...(changed && editReason ? { editReason } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Edit Objective</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        {changed && (
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">
              Why this edit?
            </span>
            <textarea
              value={editReason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Required during active cycles"
            />
          </label>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VersionHistory({ objectiveId }: { objectiveId: string }) {
  type Version = {
    id: string;
    versionNumber: number;
    title: string;
    description: string | null;
    status: string;
    editReason: string | null;
    createdAt: string;
  };
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch(`/api/v1/objectives/${objectiveId}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.data ?? []))
      .catch(() => setVersions([]))
      .finally(() => setLoaded(true));
    return <p className="text-xs text-zinc-500 mt-2">Loading…</p>;
  }
  if (!versions || versions.length === 0) {
    return <p className="text-xs text-zinc-500 mt-2">No versions.</p>;
  }
  return (
    <ol className="mt-2 space-y-2 text-sm">
      {versions.map((v) => (
        <li
          key={v.id}
          className="border-l-2 border-zinc-200 dark:border-zinc-800 pl-3"
        >
          <p className="text-xs text-zinc-500">
            v{v.versionNumber} · {new Date(v.createdAt).toLocaleString()}
          </p>
          <p className="font-medium">{v.title}</p>
          {v.editReason && (
            <p className="text-xs text-zinc-500 italic">
              Reason: {v.editReason}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
