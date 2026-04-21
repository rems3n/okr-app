import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import {
  cycles,
  keyResults,
  objectives,
  users,
} from "@/lib/db/schema";

const Query = z.object({
  q: z.string().min(1).max(100),
});

const LIMIT_PER_CATEGORY = 6;

export type SearchResult = {
  objectives: Array<{
    id: string;
    title: string;
    cycleId: string;
    cycleName: string;
  }>;
  keyResults: Array<{
    id: string;
    title: string;
    objectiveId: string;
    objectiveTitle: string;
  }>;
  cycles: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
};

/**
 * Unified search for the global Cmd+K palette. Returns up to N results per
 * entity type, filtered by the caller's organization via the inner joins.
 * v1 is simple ILIKE; we can swap to Postgres full-text or Tantivy later.
 */
export const GET = withAuth<z.infer<typeof Query>>({
  input: Query,
  handler: async ({ ctx, input }): Promise<SearchResult> => {
    const needle = `%${input.q}%`;

    const [objRows, krRows, cycleRows, userRows] = await Promise.all([
      db
        .select({
          id: objectives.id,
          title: objectives.title,
          cycleId: objectives.cycleId,
          cycleName: cycles.name,
        })
        .from(objectives)
        .innerJoin(cycles, eq(cycles.id, objectives.cycleId))
        .where(
          and(
            eq(objectives.organizationId, ctx.orgId),
            isNull(objectives.deletedAt),
            or(
              ilike(objectives.title, needle),
              ilike(objectives.description, needle),
            ),
          ),
        )
        .limit(LIMIT_PER_CATEGORY),

      db
        .select({
          id: keyResults.id,
          title: keyResults.title,
          objectiveId: keyResults.objectiveId,
          objectiveTitle: objectives.title,
        })
        .from(keyResults)
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .where(
          and(
            eq(objectives.organizationId, ctx.orgId),
            isNull(keyResults.deletedAt),
            isNull(objectives.deletedAt),
            ilike(keyResults.title, needle),
          ),
        )
        .limit(LIMIT_PER_CATEGORY),

      db
        .select({ id: cycles.id, name: cycles.name })
        .from(cycles)
        .where(
          and(
            eq(cycles.organizationId, ctx.orgId),
            ilike(cycles.name, needle),
          ),
        )
        .limit(LIMIT_PER_CATEGORY),

      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(
          and(
            eq(users.organizationId, ctx.orgId),
            or(ilike(users.name, needle), ilike(users.email, needle)),
          ),
        )
        .limit(LIMIT_PER_CATEGORY),
    ]);

    return {
      objectives: objRows,
      keyResults: krRows,
      cycles: cycleRows,
      users: userRows,
    };
  },
});
