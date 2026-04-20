"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { apiSend, ApiRequestError } from "@/lib/api/client";

/**
 * Admin-only dashboard card that calls /api/v1/ai/summarize-check-ins and
 * renders a 3-4 sentence narrative of the last week. Not cached client-side
 * — a user pressing "Regenerate" sends a fresh request.
 */
export function AiSummaryCard({
  cycleId,
}: {
  cycleId: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiSend<{ summary: string }>(
        "/api/v1/ai/summarize-check-ins",
        "POST",
        { cycleId, scope: "company" },
      );
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold">This week&apos;s signal</h2>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          disabled={busy}
          className="text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          {busy ? "Thinking…" : summary ? "Regenerate" : "Summarize"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : summary ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
          {summary}
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          AI-generated 3-4 sentence read on this week&apos;s check-ins.
        </p>
      )}
    </div>
  );
}
