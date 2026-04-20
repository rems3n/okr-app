"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCycles } from "@/hooks/use-cycles";
import { useMembers } from "@/hooks/use-members";
import { useObjectives } from "@/hooks/use-objectives";
import { useTeams } from "@/hooks/use-teams";
import { apiSend, ApiRequestError } from "@/lib/api/client";

export function ObjectivesPage({ currentUserId }: { currentUserId: string }) {
  const { cycles, isLoading: cyclesLoading } = useCycles();
  const defaultCycleId = useMemo(() => {
    if (cycles.length === 0) return null;
    const active = cycles.find((c) => c.status === "active");
    return active?.id ?? cycles[0].id;
  }, [cycles]);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const effectiveCycleId = cycleId ?? defaultCycleId;
  const { objectives, isLoading, mutate } = useObjectives(effectiveCycleId);
  const [creating, setCreating] = useState(false);

  if (cyclesLoading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }
  if (cycles.length === 0) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">No cycles yet</h1>
        <p className="text-sm text-zinc-500">
          Create your first cycle before writing objectives.
        </p>
        <Link
          href="/settings/cycles"
          className="inline-flex rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
        >
          Go to cycles →
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-4 max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Objectives</h1>
          <p className="text-sm text-zinc-500">
            {objectives.length} in this cycle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={effectiveCycleId ?? ""}
            onChange={(e) => setCycleId(e.target.value || null)}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "active" ? " · active" : ""}
              </option>
            ))}
          </select>
          {effectiveCycleId && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
            >
              New objective
            </button>
          )}
        </div>
      </header>

      {creating && effectiveCycleId && (
        <CreateObjectiveDialog
          cycleId={effectiveCycleId}
          currentUserId={currentUserId}
          existingObjectives={objectives}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            mutate();
          }}
        />
      )}

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : objectives.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">
            No objectives in this cycle yet.
          </p>
        ) : (
          objectives.map((o) => (
            <Link
              key={o.id}
              href={`/objectives/${o.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{o.title}</p>
                  {o.description && (
                    <p className="text-xs text-zinc-500 truncate">
                      {o.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ProgressPill value={Number(o.progress)} />
                  <span className="text-xs text-zinc-500 capitalize">
                    {o.status}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function ProgressPill({ value }: { value: number }) {
  const pct = Math.round(value);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        {pct}%
      </span>
    </div>
  );
}

type ObjectiveListItem = { id: string; title: string };

function CreateObjectiveDialog({
  cycleId,
  currentUserId,
  existingObjectives,
  onClose,
  onCreated,
}: {
  cycleId: string;
  currentUserId: string;
  existingObjectives: ObjectiveListItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { members } = useMembers();
  const { teams } = useTeams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(currentUserId);
  const [teamId, setTeamId] = useState<string>("");
  const [parentObjectiveId, setParentObjectiveId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/objectives", "POST", {
        cycleId,
        title,
        description: description || null,
        ownerUserId,
        teamId: teamId || null,
        parentObjectiveId: parentObjectiveId || null,
      });
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
        <h3 className="text-lg font-semibold">New objective</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="e.g. Double activation rate"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Owner</span>
            <select
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Team</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">No team (individual or company)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Aligns to</span>
          <select
            value={parentObjectiveId}
            onChange={(e) => setParentObjectiveId(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">— top level —</option>
            {existingObjectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
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
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
