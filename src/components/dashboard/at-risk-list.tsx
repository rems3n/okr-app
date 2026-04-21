import Link from "next/link";

import { ConfidenceBadge } from "@/components/okr/objective-detail";

export type AtRiskKrRow = {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  confidence: "at_risk" | "off_track";
  ownerName: string;
  daysSince: number | null;
};

export function AtRiskList({ rows }: { rows: AtRiskKrRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
          KRs marked at risk
        </h2>
        <p className="text-xs text-zinc-500">
          From the latest check-in confidence
        </p>
      </div>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/objectives/${r.objectiveId}`}
            className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {r.objectiveTitle} · {r.ownerName}
                  {r.daysSince !== null && ` · ${r.daysSince}d ago`}
                </p>
              </div>
              <ConfidenceBadge value={r.confidence} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
