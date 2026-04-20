import Link from "next/link";

import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";

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
            Start by creating a cycle (a quarter is the usual cadence), then
            write your first objectives.
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

  const currentCycleId = active?.id ?? cycles[0].id;
  const objectives = await db.listObjectives({ cycleId: currentCycleId });
  const currentCycle = active ?? cycles[0];
  const daysRemaining = daysBetween(
    new Date(),
    new Date(currentCycle.endDate),
  );
  const avgProgress =
    objectives.length > 0
      ? objectives.reduce((sum, o) => sum + Number(o.progress), 0) /
        objectives.length
      : 0;

  return (
    <section className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {currentCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 capitalize">
          {currentCycle.status} · {daysRemaining} days remaining · {objectives.length}{" "}
          {objectives.length === 1 ? "objective" : "objectives"} · avg{" "}
          {Math.round(avgProgress)}%
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/objectives"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <p className="text-sm text-zinc-500">Browse</p>
          <p className="font-medium">All objectives</p>
        </Link>
        <Link
          href={`/objectives?cycleId=${currentCycleId}`}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <p className="text-sm text-zinc-500">Create</p>
          <p className="font-medium">New objective</p>
        </Link>
        <Link
          href="/settings/cycles"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <p className="text-sm text-zinc-500">Manage</p>
          <p className="font-medium">Cycles</p>
        </Link>
      </div>

      {objectives.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Top-level objectives</h2>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
            {objectives
              .filter((o) => !o.parentObjectiveId)
              .slice(0, 10)
              .map((o) => (
                <Link
                  key={o.id}
                  href={`/objectives/${o.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium truncate">{o.title}</p>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {Math.round(Number(o.progress))}%
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
