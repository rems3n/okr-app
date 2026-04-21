import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import {
  checkIns,
  comments,
  keyResultScores,
  users,
} from "@/lib/db/schema";

const Query = z.object({
  cycleId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

type ActivityEvent = {
  id: string;
  type: "check_in" | "comment" | "score";
  createdAt: Date;
  actorName: string;
  objectiveId: string;
  objectiveTitle: string;
  keyResultId: string | null;
  keyResultTitle: string | null;
  summary: string;
};

/**
 * Unions check-ins, comments (on objectives or KRs in this cycle), and KR
 * scores into a single recent-activity feed for the dashboard. Each event
 * carries enough context to render a one-liner with a link back.
 */
export const GET = withAuth<z.infer<typeof Query>>({
  input: Query,
  handler: async ({ ctx, db: scoped, input }) => {
    const cycle = await scoped.getCycleById(input.cycleId);
    if (!cycle) return [];

    const krRows = await scoped.listKrsForCycle(cycle.id);
    if (krRows.length === 0) return [];
    const krIds = krRows.map((r) => r.kr.id);
    const krMap = new Map(
      krRows.map((r) => [r.kr.id, { title: r.kr.title, obj: r.obj }] as const),
    );
    const objIds = [...new Set(krRows.map((r) => r.obj.id))];

    const [checkInRows, scoreRows, krCommentRows, objCommentRows] =
      await Promise.all([
        db
          .select({
            id: checkIns.id,
            createdAt: checkIns.createdAt,
            confidence: checkIns.confidence,
            previousValue: checkIns.previousValue,
            newValue: checkIns.newValue,
            authorName: users.name,
            keyResultId: checkIns.keyResultId,
          })
          .from(checkIns)
          .innerJoin(users, eq(users.id, checkIns.authorUserId))
          .where(inArray(checkIns.keyResultId, krIds))
          .orderBy(desc(checkIns.createdAt))
          .limit(input.limit),
        db
          .select({
            id: keyResultScores.id,
            createdAt: keyResultScores.createdAt,
            score: keyResultScores.score,
            keyResultId: keyResultScores.keyResultId,
            authorName: users.name,
          })
          .from(keyResultScores)
          .innerJoin(users, eq(users.id, keyResultScores.scoredByUserId))
          .where(inArray(keyResultScores.keyResultId, krIds))
          .orderBy(desc(keyResultScores.createdAt))
          .limit(input.limit),
        db
          .select({
            id: comments.id,
            createdAt: comments.createdAt,
            body: comments.body,
            entityId: comments.entityId,
            authorName: users.name,
          })
          .from(comments)
          .innerJoin(users, eq(users.id, comments.authorUserId))
          .where(
            and(
              eq(comments.organizationId, ctx.orgId),
              eq(comments.entityType, "key_result"),
              inArray(comments.entityId, krIds),
            ),
          )
          .orderBy(desc(comments.createdAt))
          .limit(input.limit),
        objIds.length === 0
          ? Promise.resolve([])
          : db
              .select({
                id: comments.id,
                createdAt: comments.createdAt,
                body: comments.body,
                entityId: comments.entityId,
                authorName: users.name,
              })
              .from(comments)
              .innerJoin(users, eq(users.id, comments.authorUserId))
              .where(
                and(
                  eq(comments.organizationId, ctx.orgId),
                  eq(comments.entityType, "objective"),
                  inArray(comments.entityId, objIds),
                ),
              )
              .orderBy(desc(comments.createdAt))
              .limit(input.limit),
      ]);

    const events: ActivityEvent[] = [];

    for (const r of checkInRows) {
      const meta = krMap.get(r.keyResultId);
      if (!meta) continue;
      events.push({
        id: `ci_${r.id}`,
        type: "check_in",
        createdAt: r.createdAt,
        actorName: r.authorName,
        objectiveId: meta.obj.id,
        objectiveTitle: meta.obj.title,
        keyResultId: r.keyResultId,
        keyResultTitle: meta.title,
        summary: `${formatConfidence(r.confidence)} · ${Number(r.previousValue)} → ${Number(r.newValue)}`,
      });
    }
    for (const r of scoreRows) {
      const meta = krMap.get(r.keyResultId);
      if (!meta) continue;
      events.push({
        id: `score_${r.id}`,
        type: "score",
        createdAt: r.createdAt,
        actorName: r.authorName,
        objectiveId: meta.obj.id,
        objectiveTitle: meta.obj.title,
        keyResultId: r.keyResultId,
        keyResultTitle: meta.title,
        summary: `Scored ${Number(r.score).toFixed(2)}`,
      });
    }
    for (const r of krCommentRows) {
      const meta = krMap.get(r.entityId);
      if (!meta) continue;
      events.push({
        id: `comm_${r.id}`,
        type: "comment",
        createdAt: r.createdAt,
        actorName: r.authorName,
        objectiveId: meta.obj.id,
        objectiveTitle: meta.obj.title,
        keyResultId: r.entityId,
        keyResultTitle: meta.title,
        summary: truncate(r.body, 80),
      });
    }
    for (const r of objCommentRows) {
      // Need objective title — look up via krRows (covers most cases) or skip
      const objMeta = krRows.find((k) => k.obj.id === r.entityId)?.obj;
      if (!objMeta) continue;
      events.push({
        id: `comm_${r.id}`,
        type: "comment",
        createdAt: r.createdAt,
        actorName: r.authorName,
        objectiveId: r.entityId,
        objectiveTitle: objMeta.title,
        keyResultId: null,
        keyResultTitle: null,
        summary: truncate(r.body, 80),
      });
    }

    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return events.slice(0, input.limit);
  },
});

function formatConfidence(c: string): string {
  if (c === "on_track") return "On track";
  if (c === "at_risk") return "At risk";
  if (c === "off_track") return "Off track";
  return c;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
