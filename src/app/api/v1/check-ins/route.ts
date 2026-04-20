import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

const ListQuery = z.object({
  keyResultId: z.uuid().optional(),
  objectiveId: z.uuid().optional(),
});

export const GET = withAuth<z.infer<typeof ListQuery>>({
  input: ListQuery,
  handler: async ({ db, input }) => {
    if (input.keyResultId) return db.listCheckInsByKr(input.keyResultId);
    if (input.objectiveId)
      return db.listCheckInsByObjective(input.objectiveId);
    throw new BadRequestError("keyResultId or objectiveId required");
  },
});

const CreateInput = z.object({
  keyResultId: z.uuid(),
  newValue: z.number(),
  confidence: z.enum(["on_track", "at_risk", "off_track"]),
  note: z.string().max(5000).nullish(),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  input: CreateInput,
  handler: async ({ ctx, db, input }) => {
    const kr = await db.getKeyResultById(input.keyResultId);
    if (!kr) throw new NotFoundError("Key result not found");
    if (kr.ownerUserId !== ctx.userId) {
      // Non-owners can check in only if they're admin/owner.
      if (ctx.role === "member") {
        throw new ForbiddenError("Only the KR owner can check in");
      }
    }
    const cycle = await db.getCycleById(kr.objective.cycleId);
    if (cycle?.status === "closed") {
      throw new BadRequestError("Cannot check in on a closed cycle");
    }
    const row = await db.createCheckIn({
      keyResultId: input.keyResultId,
      authorUserId: ctx.userId,
      newValue: input.newValue,
      confidence: input.confidence,
      note: input.note ?? null,
    });
    if (!row) throw new NotFoundError();
    await db.recomputeObjectiveProgress(kr.objectiveId);
    return row;
  },
});
