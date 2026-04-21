import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError, NotFoundError } from "@/lib/errors";

const CreateInput = z.object({
  objectiveId: z.uuid(),
  title: z.string().min(1).max(200),
  krType: z.enum(["number", "percentage", "currency", "milestone"]),
  startValue: z.number(),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  unit: z.string().max(32).nullish(),
  ownerUserId: z.uuid().optional(),
  progressMode: z.enum(["auto", "manual"]).optional(),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  input: CreateInput,
  handler: async ({ ctx, db, input }) => {
    const obj = await db.getObjectiveById(input.objectiveId);
    if (!obj) throw new NotFoundError("Objective not found");
    const cycle = await db.getCycleById(obj.cycleId);
    if (cycle?.status === "grading" || cycle?.status === "closed") {
      throw new BadRequestError(
        `Cannot create key results in a ${cycle?.status} cycle`,
      );
    }
    const ownerUserId = input.ownerUserId ?? ctx.userId;
    const owner = await db.getUserById(ownerUserId);
    if (!owner) throw new BadRequestError("Owner not in this organization");

    const created = await db.createKeyResult(
      {
        objectiveId: input.objectiveId,
        ownerUserId,
        title: input.title,
        krType: input.krType,
        startValue: input.startValue.toString(),
        targetValue: input.targetValue.toString(),
        currentValue: (input.currentValue ?? input.startValue).toString(),
        unit: input.unit ?? null,
        ...(input.progressMode ? { progressMode: input.progressMode } : {}),
      },
      ctx.userId,
    );
    if (!created) throw new NotFoundError();
    await db.recomputeObjectiveProgress(input.objectiveId);
    return created;
  },
});
