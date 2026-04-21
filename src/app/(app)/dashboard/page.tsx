import Link from "next/link";

import { AiSummaryCard } from "@/components/ai/summary-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AtRiskList, type AtRiskKrRow } from "@/components/dashboard/at-risk-list";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ExpandableObjectiveRow } from "@/components/okr/expandable-objective-row";
import { can, type Role } from "@/lib/auth/permissions";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";
import { pace, type Pace } from "@/lib/okr/progress";

type Confidence = "on_track" | "at_risk" | "off_track" | "no_data";

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
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";

  const [objectives, pendingKrs, krsForCycle, scoreCoverage] =
    await Promise.all([
      db.listObjectives({ cycleId: currentCycle.id }),
      db.listKrsNeedingCheckIn(ctx.userId, currentCycle.id),
      isAdmin ? db.listKrsForCycle(currentCycle.id) : Promise.resolve([]),
      isAdmin
        ? db.scoreCoverageForCycle(currentCycle.id)
        : Promise.resolve({ total: 0, scored: 0, unscoredKrIds: [] }),
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

  const topLevel = objectives.filter((o) => !o.parentObjectiveId);
  const needsAttention = objectives
    .filter((o) => paceOf(Number(o.progress)) === "behind")
    .sort((a, b) => Number(a.progress) - Number(b.progress))
    .slice(0, 5);
  const mine = objectives.filter((o) => o.ownerUserId === ctx.userId);

  // Confidence buckets + at-risk list (admin only — uses extra query above)
  let confidenceCounts: Record<Confidence, number> = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    no_data: krsForCycle.length,
  };
  let atRiskRows: AtRiskKrRow[] = [];
  if (isAdmin && krsForCycle.length > 0) {
    const krIds = krsForCycle.map((r) => r.kr.id);
    const latest = await db.latestCheckInsFor(krIds);
    const byKr = new Map(latest.map((l) => [l.keyResultId, l]));
    confidenceCounts = krsForCycle.reduce<Record<Confidence, number>>(
      (acc, r) => {
        const c = byKr.get(r.kr.id)?.confidence ?? "no_data";
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      },
      { on_track: 0, at_risk: 0, off_track: 0, no_data: 0 },
    );
    const now = new Date().getTime();
    const candidates: AtRiskKrRow[] = [];
    for (const r of krsForCycle) {
      const last = byKr.get(r.kr.id);
      if (!last) continue;
      if (last.confidence !== "at_risk" && last.confidence !== "off_track")
        continue;
      candidates.push({
        id: r.kr.id,
        title: r.kr.title,
        objectiveId: r.obj.id,
        objectiveTitle: r.obj.title,
        confidence: last.confidence,
        ownerName: r.ownerName,
        daysSince: Math.floor(
          (now - last.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      });
    }
    const order = { off_track: 0, at_risk: 1 } as const;
    candidates.sort((a, b) => {
      if (a.confidence !== b.confidence)
        return order[a.confidence] - order[b.confidence];
      return (b.daysSince ?? 0) - (a.daysSince ?? 0);
    });
    atRiskRows = candidates.slice(0, 8);
  }
  const scoringActive =
    currentCycle.status === "grading" || currentCycle.status === "closed";

  return (
    <section className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {currentCycle.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 capitalize">
            {currentCycle.status} · {daysRemaining} days remaining ·{" "}
            {objectives.length}{" "}
            {objectives.length === 1 ? "objective" : "objectives"} · avg{" "}
            {Math.round(avgProgress)}%
          </p>
        </div>
        {objectives.length > 0 && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href={`/cycles/${currentCycle.id}/board`}
                className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                Board view
              </Link>
            )}
            <Link
              href="/objectives?create=1"
              className="rounded-md bg-zinc-900 text-white px-3 py-1.5 text-sm dark:bg-zinc-50 dark:text-zinc-900"
            >
              New objective
            </Link>
          </div>
        )}
      </header>

      {objectives.length === 0 && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/40 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-violet-900 dark:text-violet-200">
            Create your first objective
          </h2>
          <p className="text-sm text-violet-800/80 dark:text-violet-300/80">
            Objectives are the outcomes you want this {currentCycle.name}.
            Each gets 2–3 measurable Key Results.
          </p>
          <div className="flex gap-2">
            <Link
              href="/objectives?create=1"
              className="rounded-md bg-violet-700 text-white px-3 py-1.5 text-sm hover:bg-violet-800"
            >
              New objective
            </Link>
            <Link
              href="/objectives?draft=1"
              className="rounded-md border border-violet-300 dark:border-violet-800 text-violet-800 dark:text-violet-300 px-3 py-1.5 text-sm hover:bg-violet-100 dark:hover:bg-violet-950"
            >
              Draft with AI
            </Link>
          </div>
        </div>
      )}

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
          <KpiRow
            cycleProgress={avgProgress}
            confidenceCounts={confidenceCounts}
            totalKrs={krsForCycle.length}
            pendingCheckIns={pendingKrs.length}
            scoredKrs={scoreCoverage.scored}
            scoringActive={scoringActive}
          />
          <AtRiskList rows={atRiskRows} />
          <AiSummaryCard cycleId={currentCycle.id} />
          <ActivityFeed cycleId={currentCycle.id} />
          <ObjectivesPanel
            title="Company objectives"
            objectives={topLevel}
            cycle={currentCycle}
            currentUserId={ctx.userId}
            currentRole={ctx.role}
            emptyMessage="No top-level objectives yet."
          />
          {needsAttention.length > 0 && (
            <ObjectivesPanel
              title="Needs attention"
              subtitle="Behind pace — surface these in the next review"
              objectives={needsAttention}
              cycle={currentCycle}
              currentUserId={ctx.userId}
              currentRole={ctx.role}
              emptyMessage=""
              accent="amber"
            />
          )}
          {mine.length > 0 && (
            <ObjectivesPanel
              title="Your objectives"
              objectives={mine}
              cycle={currentCycle}
              currentUserId={ctx.userId}
              currentRole={ctx.role}
              emptyMessage=""
            />
          )}
        </>
      ) : (
        <>
          <ObjectivesPanel
            title="Your objectives"
            objectives={mine}
            cycle={currentCycle}
            currentUserId={ctx.userId}
            currentRole={ctx.role}
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
            cycle={currentCycle}
            currentUserId={ctx.userId}
            currentRole={ctx.role}
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
  ownerUserId: string;
  manualPaceStatus: "ahead" | "on_pace" | "behind" | null;
};

function ObjectivesPanel({
  title,
  subtitle,
  objectives,
  cycle,
  currentUserId,
  currentRole,
  emptyMessage,
  action,
  accent,
}: {
  title: string;
  subtitle?: string;
  objectives: ObjectiveSummary[];
  cycle: { startDate: string; endDate: string };
  currentUserId: string;
  currentRole: Role;
  emptyMessage: string;
  action?: React.ReactNode;
  accent?: "amber";
}) {
  const isAdmin = can(currentRole, "team.manage");
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
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950">
          {objectives.map((o) => {
            const isOwner = o.ownerUserId === currentUserId;
            return (
              <ExpandableObjectiveRow
                key={o.id}
                objective={o}
                cycle={cycle}
                canEditObjective={isOwner || isAdmin}
                canEditKrs={isOwner || isAdmin}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
