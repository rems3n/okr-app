"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePendingCheckIns, type PendingKr } from "@/hooks/use-check-ins";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Confidence = "on_track" | "at_risk" | "off_track";

export function CheckInFlow() {
  const { pending, isLoading, mutate } = usePendingCheckIns();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  if (done || pending.length === 0) {
    return (
      <section className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re all caught up
        </h1>
        <p className="text-sm text-zinc-500">
          {done
            ? "All your KRs updated. Nice work."
            : "Nothing needs a check-in right now."}
        </p>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
          >
            Back to dashboard
          </Link>
          <Link
            href="/my-okrs"
            className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm"
          >
            Your OKRs →
          </Link>
        </div>
      </section>
    );
  }

  const kr = pending[index];

  return (
    <section className="max-w-xl space-y-6">
      <header>
        <p className="text-xs text-zinc-500">
          Check-in {index + 1} of {pending.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Weekly check-in
        </h1>
      </header>
      <CheckInCard
        key={kr.id}
        kr={kr}
        onDone={async (skip) => {
          if (!skip) await mutate();
          const next = index + 1;
          if (next >= pending.length) {
            setDone(true);
            router.refresh();
          } else {
            setIndex(next);
          }
        }}
      />
      <div className="flex justify-between text-sm text-zinc-500">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="disabled:opacity-40"
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={() => {
            const next = index + 1;
            if (next >= pending.length) setDone(true);
            else setIndex(next);
          }}
        >
          Skip →
        </button>
      </div>
    </section>
  );
}

function CheckInCard({
  kr,
  onDone,
}: {
  kr: PendingKr;
  onDone: (skip: boolean) => void;
}) {
  const [value, setValue] = useState(kr.currentValue);
  const [confidence, setConfidence] = useState<Confidence>("on_track");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/check-ins", "POST", {
        keyResultId: kr.id,
        newValue: Number(value),
        confidence,
        note: note || null,
      });
      onDone(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 p-6 space-y-4"
    >
      <div>
        <p className="text-xs text-zinc-500">
          {kr.objective.title}
        </p>
        <h2 className="text-lg font-semibold mt-0.5">{kr.title}</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Last updated:{" "}
          {kr.lastCheckInAt
            ? new Date(kr.lastCheckInAt).toLocaleDateString()
            : "never"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">New value</span>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">Target</span>
          <p className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
            {kr.targetValue} {kr.unit ?? ""}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">
          Confidence
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["on_track", "On track", "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"],
              ["at_risk", "At risk", "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"],
              ["off_track", "Off track", "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"],
            ] as const
          ).map(([val, label, active]) => (
            <button
              key={val}
              type="button"
              onClick={() => setConfidence(val)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                confidence === val
                  ? active
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-zinc-700 dark:text-zinc-300">
          Note (optional)
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          placeholder="What happened this week?"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save & next"}
        </button>
      </div>
    </form>
  );
}
