import { cn } from "@/lib/utils";

type Confidence = "on_track" | "at_risk" | "off_track" | "no_data";

export type KpiRowProps = {
  cycleProgress: number; // 0-100
  confidenceCounts: Record<Confidence, number>;
  totalKrs: number;
  pendingCheckIns: number;
  scoredKrs: number;
  scoringActive: boolean; // when cycle is in grading or closed
};

/**
 * Four KPI tiles for the admin dashboard. Each tile is small and dense so
 * Sarah can read them in 5 seconds.
 */
export function KpiRow({
  cycleProgress,
  confidenceCounts,
  totalKrs,
  pendingCheckIns,
  scoredKrs,
  scoringActive,
}: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Tile
        label="Cycle progress"
        value={`${Math.round(cycleProgress)}%`}
        hint={progressHint(cycleProgress)}
      />
      <ConfidenceTile counts={confidenceCounts} totalKrs={totalKrs} />
      <Tile
        label="Pending check-ins"
        value={pendingCheckIns.toString()}
        hint={pendingCheckIns === 0 ? "All caught up" : "Owners need a nudge"}
        accent={pendingCheckIns > 0 ? "amber" : undefined}
      />
      {scoringActive ? (
        <Tile
          label="KRs scored"
          value={`${scoredKrs} / ${totalKrs}`}
          hint={
            totalKrs === 0
              ? "No KRs yet"
              : scoredKrs === totalKrs
                ? "Cycle ready to close"
                : `${totalKrs - scoredKrs} left to grade`
          }
          accent={scoredKrs === totalKrs ? "emerald" : "amber"}
        />
      ) : (
        <Tile
          label="Total KRs"
          value={totalKrs.toString()}
          hint="Across the cycle"
        />
      )}
    </div>
  );
}

function progressHint(p: number): string {
  if (p === 0) return "Just getting started";
  if (p < 30) return "Early days";
  if (p < 70) return "On the climb";
  if (p < 100) return "Nearly there";
  return "Finished";
}

function Tile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: "amber" | "emerald";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white dark:bg-zinc-950 px-4 py-3",
        "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums mt-0.5",
          accent === "amber" && "text-amber-700 dark:text-amber-400",
          accent === "emerald" && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>
    </div>
  );
}

function ConfidenceTile({
  counts,
  totalKrs,
}: {
  counts: Record<Confidence, number>;
  totalKrs: number;
}) {
  const segments: Array<[Confidence, string, string]> = [
    ["on_track", "bg-emerald-500", "On track"],
    ["at_risk", "bg-amber-500", "At risk"],
    ["off_track", "bg-red-500", "Off track"],
    ["no_data", "bg-zinc-300 dark:bg-zinc-700", "No data"],
  ];
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3">
      <p className="text-xs text-zinc-500">KR confidence</p>
      <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-zinc-100 dark:bg-zinc-800">
        {totalKrs === 0 ? null : (
          segments.map(([key, cls]) => {
            const pct = (counts[key] / totalKrs) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                className={cls}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            );
          })
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        {segments.map(([key, cls, label]) => (
          <li key={key} className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <span className={cn("h-2 w-2 rounded-full", cls)} aria-hidden />
            <span>{label}</span>
            <span className="ml-auto tabular-nums text-zinc-700 dark:text-zinc-300">
              {counts[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
