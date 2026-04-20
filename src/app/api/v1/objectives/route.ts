import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { requireCapacity } from "@/lib/billing/gating";
import { BadRequestError, NotFoundError } from "@/lib/errors";

const ListQuery = z.object({
  cycleId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  teamId: z.uuid().optional(),
  parentObjectiveId: z.union([z.uuid(), z.literal("null")]).optional(),
});

export const GET = withAuth<z.infer<typeof ListQuery>>({
  input: ListQuery,
  handler: async ({ db, input }) => {
    return db.listObjectives({
      cycleId: input.cycleId,
      ownerUserId: input.ownerUserId,
      teamId: input.teamId,
      parentObjectiveId:
        input.parentObjectiveId === "null" ? null : input.parentObjectiveId,
    });
  },
});

const CreateInput = z.object({
  cycleId: z.uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  ownerUserId: z.uuid().optional(),
  teamId: z.uuid().nullish(),
  parentObjectiveId: z.uuid().nullish(),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  input: CreateInput,
  handler: async ({ ctx, db, input }) => {
    await requireCapacity(ctx.orgId, { kind: "objectives" });
    const cycle = await db.getCycleById(input.cycleId);
    if (!cycle) throw new NotFoundError("Cycle not found");
    if (cycle.status === "grading" || cycle.status === "closed") {
      throw new BadRequestError(
        `Cannot create objectives in a ${cycle.status} cycle`,
      );
    }
    if (input.parentObjectiveId) {
      const parent = await db.getObjectiveById(input.parentObjectiveId);
      if (!parent) throw new BadRequestError("Parent objective not found");
      if (parent.cycleId !== cycle.id) {
        throw new BadRequestError("Parent must be in the same cycle");
      }
    }
    const ownerUserId = input.ownerUserId ?? ctx.userId;
    const owner = await db.getUserById(ownerUserId);
    if (!owner) throw new BadRequestError("Owner not in this organization");
    const created = await db.createObjective(
      {
        cycleId: cycle.id,
        ownerUserId,
        title: input.title,
        description: input.description ?? null,
        teamId: input.teamId ?? null,
        parentObjectiveId: input.parentObjectiveId ?? null,
        status: cycle.status === "active" ? "active" : "draft",
      },
      ctx.userId,
    );
    return created;
  },
});
