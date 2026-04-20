import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { can } from "@/lib/auth/permissions";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

export const GET = withAuth<undefined, { objectiveId: string }>({
  handler: async ({ db, params }) => {
    const obj = await db.getObjectiveById(params.objectiveId);
    if (!obj) throw new NotFoundError();
    const [keyResults, children] = await Promise.all([
      db.listKeyResultsByObjective(obj.id),
      db.listObjectives({
        cycleId: obj.cycleId,
        parentObjectiveId: obj.id,
      }),
    ]);
    const parent = obj.parentObjectiveId
      ? await db.getObjectiveById(obj.parentObjectiveId)
      : null;
    // Per-KR binding info so the UI can render the source badge without an
    // N+1 round-trip.
    const bindings = await Promise.all(
      keyResults.map((kr) => db.getBindingForKr(kr.id)),
    );
    const bindingsByKr = Object.fromEntries(
      keyResults.map((kr, idx) => {
        const b = bindings[idx];
        return [
          kr.id,
          b
            ? {
                provider: b.integration.provider,
                metricLabel: b.definition.label,
                lastSyncedAt: b.integration.lastSyncedAt,
              }
            : null,
        ];
      }),
    );
    return {
      objective: obj,
      keyResults,
      children,
      parent,
      bindingsByKr,
    };
  },
});

const PatchInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullish(),
  teamId: z.uuid().nullish(),
  parentObjectiveId: z.uuid().nullish(),
  status: z.enum(["draft", "active", "closed"]).optional(),
  ownerUserId: z.uuid().optional(),
  editReason: z.string().max(500).optional(),
});

export const PATCH = withAuth<
  z.infer<typeof PatchInput>,
  { objectiveId: string }
>({
  input: PatchInput,
  handler: async ({ ctx, db, params, input }) => {
    const obj = await db.getObjectiveById(params.objectiveId);
    if (!obj) throw new NotFoundError();

    const isOwner = obj.ownerUserId === ctx.userId;
    if (!isOwner && !can(ctx.role, "team.manage")) {
      throw new ForbiddenError("Only the owner or an admin can edit");
    }

    const cycle = await db.getCycleById(obj.cycleId);
    if (cycle?.status === "active") {
      const titleChanged =
        input.title !== undefined && input.title !== obj.title;
      const descChanged =
        input.description !== undefined && input.description !== obj.description;
      if ((titleChanged || descChanged) && !input.editReason) {
        throw new BadRequestError(
          "editReason is required when editing title or description during an active cycle",
        );
      }
    }

    if (input.parentObjectiveId) {
      const parent = await db.getObjectiveById(input.parentObjectiveId);
      if (!parent) throw new BadRequestError("Parent objective not found");
      if (parent.cycleId !== obj.cycleId) {
        throw new BadRequestError("Parent must be in the same cycle");
      }
      if (parent.id === obj.id) {
        throw new BadRequestError("Objective cannot be its own parent");
      }
    }

    const { editReason, ...patch } = input;
    const updated = await db.updateObjective(
      obj.id,
      patch,
      ctx.userId,
      editReason,
    );
    if (!updated) throw new NotFoundError();
    return updated;
  },
});

export const DELETE = withAuth<undefined, { objectiveId: string }>({
  handler: async ({ ctx, db, params }) => {
    const obj = await db.getObjectiveById(params.objectiveId);
    if (!obj) throw new NotFoundError();
    const isOwner = obj.ownerUserId === ctx.userId;
    if (!isOwner && !can(ctx.role, "team.manage")) {
      throw new ForbiddenError("Only the owner or an admin can delete");
    }
    const children = await db.listObjectives({
      cycleId: obj.cycleId,
      parentObjectiveId: obj.id,
    });
    if (children.length > 0) {
      throw new BadRequestError(
        "Cannot delete: this objective has children. Unlink or delete them first.",
      );
    }
    await db.softDeleteObjective(obj.id);
    return { deleted: true };
  },
});
