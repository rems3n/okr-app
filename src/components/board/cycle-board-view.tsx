import { type CycleBoardData } from "@/lib/cycle-board";
import { cn } from "@/lib/utils";

const CONFIDENCE_LABEL = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  no_data: "No data",
} as const;

const CONFIDENCE_DOT = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  off_track: "bg-red-500",
  no_data: "bg-zinc-300",
} as const;

/**
 * Print-optimized one-page-per-objective board view. Used by both the
 * authenticated /cycles/[id]/board page and the public share-link page.
 */
export function CycleBoardView({ data }: { data: CycleBoardData }) {
  const avg =
    data.objectives.length > 0
      ? data.objectives.reduce((sum, o) => sum + o.progress, 0) /
        data.objectives.length
      : 0;
  return (
    <article className="max-w-4xl mx-auto bg-white text-zinc-900 print:max-w-none">
      <header className="border-b border-zinc-200 pb-4 mb-6 flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {data.organization.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.cycle.name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1 capitalize">
            {data.cycle.status} · {data.cycle.startDate} → {data.cycle.endDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">
            {Math.round(avg)}%
          </p>
          <p className="text-xs text-zinc-500">Average progress</p>
        </div>
      </header>

      {data.objectives.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No objectives in this cycle yet.
        </p>
      ) : (
        <div className="space-y-6 print:space-y-8">
          {data.objectives.map((o) => (
            <section
              key={o.id}
              className="break-inside-avoid border border-zinc-200 rounded-lg p-5"
            >
              <header className="flex items-baseline justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{o.title}</h2>
                  {o.description && (
                    <p className="text-sm text-zinc-600 mt-1 whitespace-pre-wrap">
                      {o.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-semibold tabular-nums">
                    {Math.round(o.progress)}%
                  </p>
                  <p className="text-xs text-zinc-500">{o.ownerName}</p>
                </div>
              </header>
              <ProgressStripe value={o.progress} />
              {o.keyResults.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {o.keyResults.map((kr) => (
                    <KrLine key={kr.id} kr={kr} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      <footer className="text-xs text-zinc-400 mt-8 print:mt-12">
        Generated {new Date(data.generatedAt).toLocaleString()}
      </footer>
    </article>
  );
}

function ProgressStripe({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
      <div
        className="h-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KrLine({ kr }: { kr: CycleBoardData["objectives"][number]["keyResults"][number] }) {
  const isMilestone = kr.krType === "milestone";
  const fmt = (n: number) =>
    kr.krType === "currency"
      ? `$${n.toLocaleString()}`
      : kr.krType === "percentage"
        ? `${n}%`
        : `${n.toLocaleString()}${kr.unit ? ` ${kr.unit}` : ""}`;
  const value = isMilestone
    ? kr.currentValue >= 100
      ? "Done"
      : "Pending"
    : `${fmt(kr.currentValue)} / ${fmt(kr.targetValue)}`;
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn("h-2 w-2 rounded-full shrink-0", CONFIDENCE_DOT[kr.confidence])}
          aria-hidden
        />
        <span className="truncate">{kr.title}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-zinc-600">
        <span className="tabular-nums">{value}</span>
        <span className="text-xs text-zinc-400">
          {CONFIDENCE_LABEL[kr.confidence]}
        </span>
      </div>
    </li>
  );
}
