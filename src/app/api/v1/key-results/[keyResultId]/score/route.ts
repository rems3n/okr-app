import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { can } from "@/lib/auth/permissions";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

const Input = z.object({
  score: z.number().min(0).max(1),
  finalValue: z.number(),
  reflection: z.string().min(20).max(2000),
});

/**
 * Score a KR. Available during `grading` and `closed` cycle statuses
 * (admins can still refine a score after the cycle closes for retro purposes).
 * The KR owner or an admin can submit.
 */
export const POST = withAuth<z.infer<typeof Input>, { keyResultId: string }>({
  input: Input,
  handler: async ({ ctx, db, params, input }) => {
    const kr = await db.getKeyResultById(params.keyResultId);
    if (!kr) throw new NotFoundError();
    const isOwner = kr.ownerUserId === ctx.userId;
    if (!isOwner && !can(ctx.role, "team.manage")) {
      throw new ForbiddenError(
        "Only the KR owner or an admin can score this KR",
      );
    }
    const cycle = await db.getCycleById(kr.objective.cycleId);
    if (!cycle) throw new NotFoundError("Cycle not found");
    if (cycle.status !== "grading" && cycle.status !== "closed") {
      throw new BadRequestError(
        `Cycle must be in grading or closed status to score KRs (currently ${cycle.status})`,
      );
    }
    const row = await db.upsertScore({
      keyResultId: kr.id,
      score: input.score,
      finalValue: input.finalValue,
      reflection: input.reflection,
      scoredByUserId: ctx.userId,
    });
    if (!row) throw new NotFoundError();
    return row;
  },
});

export const GET = withAuth<undefined, { keyResultId: string }>({
  handler: async ({ db, params }) => {
    return db.getScoreForKr(params.keyResultId);
  },
});
