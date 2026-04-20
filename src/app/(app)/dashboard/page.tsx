import Link from "next/link";

import { AiSummaryCard } from "@/components/ai/summary-card";
import {
  LevelIcon,
  PaceDot,
  ProgressBar,
} from "@/components/okr/objective-row";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";
import { pace, type Pace } from "@/lib/okr/progress";

function daysBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  const db = scopedDb(ctx.orgId);
  const [cycles, active] = await Promise.all([
    db.listCycles(),
    db.getActiveCycle(),
  ]);

  if (cycles.length === 0) {
    return (
      <section className="max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {ctx.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Start by creating a cycle, then write your first objectives.
          </p>
        </div>
        <Link
          href="/settings/cycles"
          className="inline-flex rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
        >
          Create your first cycle →
        </Link>
      </section>
    );
  }

  const currentCycle = active ?? cycles[0];
  const [objectives, pendingKrs] = await Promise.all([
    db.listObjectives({ cycleId: currentCycle.id }),
    db.listKrsNeedingCheckIn(ctx.userId, currentCycle.id),
  ]);
  const daysRemaining = daysBetween(new Date(), new Date(currentCycle.endDate));
  const avgProgress =
    objectives.length > 0
      ? objectives.reduce((sum, o) => sum + Number(o.progress), 0) /
        objectives.length
      : 0;

  const cycleStart = new Date(currentCycle.startDate);
  const cycleEnd = new Date(currentCycle.endDate);
  const paceOf = (progress: number): Pace | "no_data" =>
    pace({ actualProgress: progress, cycleStart, cycleEnd }).status;

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const topLevel = objectives.filter((o) => !o.parentObjectiveId);
  const needsAttention = objectives
    .filter((o) => paceOf(Number(o.progress)) === "behind")
    .sort((a, b) => Number(a.progress) - Number(b.progress))
    .slice(0, 5);
  const mine = objectives.filter((o) => o.ownerUserId === ctx.userId);

  return (
    <section className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {currentCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 capitalize">
          {currentCycle.status} · {daysRemaining} days remaining ·{" "}
          {objectives.length}{" "}
          {objectives.length === 1 ? "objective" : "objectives"} · avg{" "}
          {Math.round(avgProgress)}%
        </p>
      </header>

      {pendingKrs.length > 0 && (
        <Link
          href="/check-in"
          className="block rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {pendingKrs.length} KR{pendingKrs.length === 1 ? "" : "s"} need a
            check-in
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            Click to run the weekly check-in flow →
          </p>
        </Link>
      )}

      {isAdmin ? (
        <>
          <AiSummaryCard cycleId={currentCycle.id} />
          <ObjectivesPanel
            title="Company objectives"
            objectives={topLevel}
            paceOf={paceOf}
            emptyMessage="No top-level objectives yet."
          />
          {needsAttention.length > 0 && (
            <ObjectivesPanel
              title="Needs attention"
              subtitle="Behind pace — surface these in the next review"
              objectives={needsAttention}
              paceOf={paceOf}
              emptyMessage=""
              accent="amber"
            />
          )}
          {mine.length > 0 && (
            <ObjectivesPanel
              title="Your objectives"
              objectives={mine}
              paceOf={paceOf}
              emptyMessage=""
            />
          )}
        </>
      ) : (
        <>
          <ObjectivesPanel
            title="Your objectives"
            objectives={mine}
            paceOf={paceOf}
            emptyMessage="You don't own any objectives in this cycle yet."
            action={
              <Link
                href="/objectives"
                className="text-xs underline text-zinc-500"
              >
                Create one
              </Link>
            }
          />
          <ObjectivesPanel
            title="Company objectives"
            objectives={topLevel}
            paceOf={paceOf}
            emptyMessage="No company-level objectives yet."
          />
        </>
      )}
    </section>
  );
}

type ObjectiveSummary = {
  id: string;
  title: string;
  progress: string;
  teamId: string | null;
  parentObjectiveId: string | null;
};

function ObjectivesPanel({
  title,
  subtitle,
  objectives,
  paceOf,
  emptyMessage,
  action,
  accent,
}: {
  title: string;
  subtitle?: string;
  objectives: ObjectiveSummary[];
  paceOf: (progress: number) => Pace | "no_data";
  emptyMessage: string;
  action?: React.ReactNode;
  accent?: "amber";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2
            className={`text-lg font-semibold ${accent === "amber" ? "text-amber-700 dark:text-amber-400" : ""}`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {objectives.length === 0 ? (
        emptyMessage && (
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        )
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
          {objectives.map((o) => (
            <Link
              key={o.id}
              href={`/objectives/${o.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-3"
            >
              <LevelIcon objective={o} />
              <p className="flex-1 min-w-0 font-medium truncate">{o.title}</p>
              <div className="flex items-center gap-4 shrink-0">
                <PaceDot status={paceOf(Number(o.progress))} />
                <ProgressBar value={Number(o.progress)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
