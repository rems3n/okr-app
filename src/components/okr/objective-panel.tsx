"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { LevelIcon, ProgressBar } from "@/components/okr/objective-row";
import { useObjective } from "@/hooks/use-objectives";
import { krProgress } from "@/lib/okr/progress";

export function ObjectivePanel({
  objectiveId,
  onClose,
}: {
  objectiveId: string | null;
  onClose: () => void;
}) {
  const { detail, isLoading } = useObjective(objectiveId);
  if (!objectiveId) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 h-full overflow-y-auto border-l border-zinc-200 dark:border-zinc-800 flex flex-col"
      >
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0">
          <span className="text-xs text-zinc-500">Objective</span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {isLoading || !detail ? (
          <div className="p-6 text-sm text-zinc-500">Loading…</div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <LevelIcon objective={detail.objective} />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  {detail.objective.title}
                </h2>
                {detail.objective.description && (
                  <p className="text-sm text-zinc-500 mt-1 whitespace-pre-wrap">
                    {detail.objective.description}
                  </p>
                )}
              </div>
            </div>

            <ProgressBar
              value={Number(detail.objective.progress)}
              width="w-full"
            />

            {detail.parent && (
              <div className="text-sm">
                <p className="text-xs text-zinc-500 mb-1">Aligned to</p>
                <Link
                  href={`/objectives/${detail.parent.id}`}
                  className="hover:underline"
                >
                  {detail.parent.title}
                </Link>
              </div>
            )}

            <div>
              <p className="text-xs text-zinc-500 mb-2">Key Results</p>
              {detail.keyResults.length === 0 ? (
                <p className="text-sm text-zinc-500">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.keyResults.map((kr) => {
                    const pct = Math.round(krProgress(kr));
                    return (
                      <li
                        key={kr.id}
                        className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm min-w-0 truncate">{kr.title}</p>
                          <span className="text-xs tabular-nums text-zinc-500 shrink-0">
                            {pct}%
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {detail.children.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Contributes from</p>
                <ul className="space-y-1 text-sm">
                  {detail.children.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/objectives/${c.id}`}
                        className="hover:underline"
                      >
                        {c.title}
                      </Link>
                      <span className="text-xs text-zinc-500 ml-2">
                        {Math.round(Number(c.progress))}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href={`/objectives/${detail.objective.id}`}
              className="inline-flex text-sm rounded-md bg-zinc-900 text-white px-3 py-1.5 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Open full detail →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
