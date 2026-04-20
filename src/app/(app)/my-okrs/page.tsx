import Link from "next/link";

import {
  LevelIcon,
  PaceDot,
  ProgressBar,
} from "@/components/okr/objective-row";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";
import { pace, type Pace } from "@/lib/okr/progress";

export default async function MyOkrsPage() {
  const ctx = await getAuthContext();
  const db = scopedDb(ctx.orgId);
  const cycles = await db.listCycles();
  const active = cycles.find((c) => c.status === "active");
  const cycle = active ?? cycles[0];

  if (!cycle) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">No cycles yet</h1>
        <p className="text-sm text-zinc-500">
          Ask an admin to create a cycle before writing OKRs.
        </p>
      </div>
    );
  }

  const mine = await db.listObjectives({
    cycleId: cycle.id,
    ownerUserId: ctx.userId,
  });
  const parentIds = [
    ...new Set(
      mine
        .map((o) => o.parentObjectiveId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const parents = (
    await Promise.all(parentIds.map((id) => db.getObjectiveById(id)))
  ).filter((p): p is NonNullable<typeof p> => p !== null);

  const cycleStart = new Date(cycle.startDate);
  const cycleEnd = new Date(cycle.endDate);

  const paceFor = (progress: number): Pace | "no_data" =>
    pace({ actualProgress: progress, cycleStart, cycleEnd }).status;

  return (
    <section className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your OKRs</h1>
        <p className="text-sm text-zinc-500">
          {cycle.name} · {mine.length}{" "}
          {mine.length === 1 ? "objective" : "objectives"} you own
        </p>
      </header>

      {mine.length === 0 ? (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 text-sm text-zinc-500">
          You don&apos;t own any objectives in this cycle yet.{" "}
          <Link href="/objectives" className="underline">
            Create one.
          </Link>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
          {mine.map((o) => (
            <Link
              key={o.id}
              href={`/objectives/${o.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-3"
            >
              <LevelIcon objective={o} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{o.title}</p>
                {o.description && (
                  <p className="text-xs text-zinc-500 truncate">
                    {o.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <PaceDot status={paceFor(Number(o.progress))} />
                <ProgressBar value={Number(o.progress)} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {parents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">You contribute to</h2>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
            {parents.map((p) => (
              <Link
                key={p.id}
                href={`/objectives/${p.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-3"
              >
                <LevelIcon objective={p} />
                <p className="flex-1 min-w-0 font-medium truncate">{p.title}</p>
                <div className="flex items-center gap-4 shrink-0">
                  <PaceDot status={paceFor(Number(p.progress))} />
                  <ProgressBar value={Number(p.progress)} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
