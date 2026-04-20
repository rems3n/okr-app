"use client";

import { Sparkles, X } from "lucide-react";
import { useState } from "react";

import { apiSend, ApiRequestError } from "@/lib/api/client";

type DraftKr = {
  title: string;
  krType: "number" | "percentage" | "currency" | "milestone";
  startValue: number;
  targetValue: number;
  unit: string | null;
};

type DraftObjective = {
  title: string;
  description: string | null;
  keyResults: DraftKr[];
};

/**
 * Drawer-style AI draft assistant. Opens when the user clicks the sparkles
 * button on the objectives page; lets them pick from 3-5 suggestions and
 * saves each as a real objective + KRs via existing API routes.
 */
export function DraftAssistant({
  cycleId,
  currentUserId,
  teamId,
  onClose,
  onCreated,
}: {
  cycleId: string;
  currentUserId: string;
  teamId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [level, setLevel] = useState<"company" | "team" | "individual">(
    "company",
  );
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftObjective[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiSend<{ objectives: DraftObjective[] }>(
        "/api/v1/ai/draft-objectives",
        "POST",
        {
          cycleId,
          level,
          teamId: teamId ?? null,
          context: context || undefined,
        },
      );
      setDrafts(res.objectives);
      setSavedIdx(new Set());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const save = async (idx: number) => {
    const draft = drafts[idx];
    setSavingIdx(idx);
    setError(null);
    try {
      const objective = await apiSend<{ id: string }>(
        "/api/v1/objectives",
        "POST",
        {
          cycleId,
          title: draft.title,
          description: draft.description,
          ownerUserId: currentUserId,
          teamId: teamId ?? null,
        },
      );
      for (const kr of draft.keyResults) {
        await apiSend("/api/v1/key-results", "POST", {
          objectiveId: objective.id,
          title: kr.title,
          krType: kr.krType,
          startValue: kr.startValue,
          targetValue: kr.targetValue,
          unit: kr.unit,
          ownerUserId: currentUserId,
        });
      }
      setSavedIdx((prev) => new Set([...prev, idx]));
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-zinc-900 h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold">Draft objectives with AI</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Level</span>
            <select
              value={level}
              onChange={(e) =>
                setLevel(e.target.value as typeof level)
              }
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="company">Company</option>
              <option value="team">Team</option>
              <option value="individual">Individual</option>
            </select>
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">
              Context (optional)
            </span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Anything particular you want the AI to consider?"
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading
              ? "Drafting…"
              : drafts.length > 0
                ? "Regenerate"
                : "Generate"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 pb-6 space-y-3">
          {drafts.map((d, idx) => {
            const saved = savedIdx.has(idx);
            return (
              <article
                key={`${idx}-${d.title}`}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-zinc-500 mt-1">
                        {d.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => save(idx)}
                    disabled={savingIdx !== null || saved}
                    className="text-xs rounded-md bg-zinc-900 text-white px-2 py-1 dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50 shrink-0"
                  >
                    {saved
                      ? "Saved"
                      : savingIdx === idx
                        ? "Saving…"
                        : "Use this"}
                  </button>
                </div>
                <ul className="space-y-1 mt-2">
                  {d.keyResults.map((kr, kIdx) => (
                    <li
                      key={kIdx}
                      className="text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      • {kr.title}{" "}
                      <span className="text-zinc-400">
                        ({kr.krType}: {kr.startValue} → {kr.targetValue}
                        {kr.unit ? ` ${kr.unit}` : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
