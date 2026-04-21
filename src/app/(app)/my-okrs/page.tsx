import Link from "next/link";

import { ExpandableObjectiveRow } from "@/components/okr/expandable-objective-row";
import { can } from "@/lib/auth/permissions";
import { getAuthContext } from "@/lib/auth/get-current-user";
import { scopedDb } from "@/lib/db/scoped";

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

  const isAdmin = can(ctx.role, "team.manage");

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
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950">
          {mine.map((o) => (
            <ExpandableObjectiveRow
              key={o.id}
              objective={o}
              cycle={cycle}
              canEditObjective
              canEditKrs
            />
          ))}
        </div>
      )}

      {parents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">You contribute to</h2>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950">
            {parents.map((p) => {
              const isOwner = p.ownerUserId === ctx.userId;
              return (
                <ExpandableObjectiveRow
                  key={p.id}
                  objective={p}
                  cycle={cycle}
                  canEditObjective={isOwner || isAdmin}
                  canEditKrs={isOwner || isAdmin}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
