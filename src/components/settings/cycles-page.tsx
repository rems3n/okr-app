"use client";

import { useState } from "react";

import { useCycles } from "@/hooks/use-cycles";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type CycleStatus = "planning" | "active" | "grading" | "closed";

const ALLOWED_NEXT: Record<CycleStatus, CycleStatus[]> = {
  planning: ["active"],
  active: ["grading"],
  grading: ["closed", "active"],
  closed: ["grading"],
};

const STATUS_LABELS: Record<CycleStatus, string> = {
  planning: "Start cycle",
  active: "Move to grading",
  grading: "Close cycle",
  closed: "Reopen grading",
};

export function CyclesPage({ currentRole }: { currentRole: Role }) {
  const { cycles, isLoading, mutate } = useCycles();
  const [creating, setCreating] = useState(false);
  const canManage = can(currentRole, "org.manage");

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cycles</h2>
          <p className="text-sm text-zinc-500">
            Track OKRs per quarter (or whatever cadence suits you).
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => setCreating(true)}
          >
            Create cycle
          </button>
        )}
      </header>

      {creating && (
        <CreateCycleDialog
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
        ) : cycles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">
            No cycles yet. Create your first cycle to start writing OKRs.
          </p>
        ) : (
          cycles.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-zinc-500">
                  {c.startDate} → {c.endDate}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-xs rounded-full px-2 py-0.5 capitalize",
                    c.status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : c.status === "grading"
                        ? "bg-amber-100 text-amber-800"
                        : c.status === "closed"
                          ? "bg-zinc-200 text-zinc-700"
                          : "bg-blue-100 text-blue-800",
                  )}
                >
                  {c.status}
                </span>
                {canManage && (
                  <TransitionButtons
                    cycleId={c.id}
                    current={c.status as CycleStatus}
                    onChange={mutate}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TransitionButtons({
  cycleId,
  current,
  onChange,
}: {
  cycleId: string;
  current: CycleStatus;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = ALLOWED_NEXT[current] ?? [];

  const transition = async (status: CycleStatus) => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/cycles/${cycleId}`, "PATCH", { status });
      onChange();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {next.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => transition(status)}
          disabled={busy}
          className="text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          {STATUS_LABELS[current]?.replace(/^.*(?=to|grading|cycle)/i, "") ||
            status}
          <span className="sr-only">{status}</span>
        </button>
      ))}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function defaultQuarter() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (q - 1) * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + 3, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    name: `Q${q} ${now.getFullYear()}`,
    startDate: fmt(start),
    endDate: fmt(end),
  };
}

function CreateCycleDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const suggested = defaultQuarter();
  const [name, setName] = useState(suggested.name);
  const [startDate, setStart] = useState(suggested.startDate);
  const [endDate, setEnd] = useState(suggested.endDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/cycles", "POST", { name, startDate, endDate });
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
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800"
      >
        <h3 className="text-lg font-semibold">Create cycle</h3>
        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Start</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">End</span>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
          </label>
        </div>
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
