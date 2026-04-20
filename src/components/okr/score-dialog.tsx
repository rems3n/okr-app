"use client";

import { useState } from "react";

import { apiSend, ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type ExistingScore = {
  score: string;
  finalValue: string;
  reflection: string;
} | null;

const GUIDANCE = [
  { max: 0.3, text: "We failed to make progress" },
  { max: 0.6, text: "We made progress but fell short" },
  { max: 0.8, text: "0.7 — hit an ambitious target (sweet spot)" },
  { max: 1.01, text: "We exceeded expectations — was the target too safe?" },
];

function guidanceFor(score: number): string {
  return GUIDANCE.find((g) => score <= g.max)?.text ?? "";
}

/**
 * Dialog for scoring a single KR at end-of-cycle. Upserts into
 * key_result_scores; reflection is required at 20+ chars.
 */
export function ScoreDialog({
  keyResultId,
  krTitle,
  currentValue,
  targetValue,
  existing,
  onClose,
  onSaved,
}: {
  keyResultId: string;
  krTitle: string;
  currentValue: string;
  targetValue: string;
  existing: ExistingScore;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [score, setScore] = useState(
    existing ? Number(existing.score) : 0.7,
  );
  const [finalValue, setFinalValue] = useState(
    existing ? existing.finalValue : currentValue,
  );
  const [reflection, setReflection] = useState(
    existing?.reflection ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reflection.trim().length < 20) {
      setError("Reflection must be at least 20 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend(
        `/api/v1/key-results/${keyResultId}/score`,
        "POST",
        {
          score,
          finalValue: Number(finalValue),
          reflection,
        },
      );
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
        <div>
          <p className="text-xs text-zinc-500">Score a KR</p>
          <h3 className="text-lg font-semibold">{krTitle}</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Target: {targetValue} · Last value: {currentValue}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="score-range" className="text-sm">
              Score
            </label>
            <span className="text-sm font-mono">{score.toFixed(2)}</span>
          </div>
          <input
            id="score-range"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full"
          />
          <p
            className={cn(
              "text-xs mt-1",
              score >= 0.6 && score <= 0.8
                ? "text-emerald-600"
                : "text-zinc-500",
            )}
          >
            {guidanceFor(score)}
          </p>
        </div>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">
            Final value
          </span>
          <input
            type="number"
            step="any"
            value={finalValue}
            onChange={(e) => setFinalValue(e.target.value)}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">
            Reflection (min 20 chars){" "}
            <span className="text-xs text-zinc-500">
              — what we learned, what we&apos;d do differently
            </span>
          </span>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            placeholder="Required. Will be visible in the cycle retro view."
          />
        </label>

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
            {busy ? "Saving…" : existing ? "Update score" : "Save score"}
          </button>
        </div>
      </form>
    </div>
  );
}
