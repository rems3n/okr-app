import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { can } from "@/lib/auth/permissions";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { krProgress } from "@/lib/okr/progress";

export const GET = withAuth<undefined, { keyResultId: string }>({
  handler: async ({ db, params }) => {
    const kr = await db.getKeyResultById(params.keyResultId);
    if (!kr) throw new NotFoundError();
    return kr;
  },
});

const PatchInput = z.object({
  title: z.string().min(1).max(200).optional(),
  krType: z.enum(["number", "percentage", "currency", "milestone"]).optional(),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(32).nullish(),
  progressMode: z.enum(["auto", "manual"]).optional(),
  sortOrder: z.number().int().optional(),
  editReason: z.string().max(500).optional(),
});

export const PATCH = withAuth<
  z.infer<typeof PatchInput>,
  { keyResultId: string }
>({
  input: PatchInput,
  handler: async ({ ctx, db, params, input }) => {
    const kr = await db.getKeyResultById(params.keyResultId);
    if (!kr) throw new NotFoundError();
    const isOwner = kr.ownerUserId === ctx.userId;
    if (!isOwner && !can(ctx.role, "team.manage")) {
      throw new ForbiddenError("Only the owner or an admin can edit");
    }
    const cycle = await db.getCycleById(kr.objective.cycleId);
    if (cycle?.status === "active") {
      const targetChanged =
        input.targetValue !== undefined &&
        input.targetValue.toString() !== kr.targetValue;
      if (targetChanged && !input.editReason) {
        throw new BadRequestError(
          "editReason is required when changing targetValue during an active cycle",
        );
      }
    }
    const { editReason, ...raw } = input;

    // Progress-mode transitions normalize value fields so `krProgress()` stays
    // meaningful on both sides of the switch. See the KR row UX plan.
    const modeChanging =
      raw.progressMode !== undefined && raw.progressMode !== kr.progressMode;
    let normalizedStart: string | undefined;
    let normalizedTarget: string | undefined;
    let normalizedCurrent: string | undefined;
    let normalizedUnit: string | null | undefined;
    if (modeChanging && raw.progressMode === "manual") {
      // auto → manual: snapshot the derived % into currentValue, reset range.
      const pct = krProgress(kr);
      normalizedCurrent = pct.toString();
      normalizedStart = "0";
      normalizedTarget = "100";
      normalizedUnit = "%";
    } else if (modeChanging && raw.progressMode === "auto") {
      // manual → auto: caller must supply new start/target/krType because
      // 0-100 doesn't tell us what the real metric is.
      if (
        raw.startValue === undefined ||
        raw.targetValue === undefined ||
        raw.krType === undefined
      ) {
        throw new BadRequestError(
          "Switching a KR from manual to auto requires krType, startValue, and targetValue in the same request",
        );
      }
    }

    const patch = {
      ...(raw.title !== undefined ? { title: raw.title } : {}),
      ...(raw.krType !== undefined ? { krType: raw.krType } : {}),
      ...(normalizedStart !== undefined
        ? { startValue: normalizedStart }
        : raw.startValue !== undefined
          ? { startValue: raw.startValue.toString() }
          : {}),
      ...(normalizedTarget !== undefined
        ? { targetValue: normalizedTarget }
        : raw.targetValue !== undefined
          ? { targetValue: raw.targetValue.toString() }
          : {}),
      ...(normalizedCurrent !== undefined
        ? { currentValue: normalizedCurrent }
        : raw.currentValue !== undefined
          ? { currentValue: raw.currentValue.toString() }
          : {}),
      ...(normalizedUnit !== undefined
        ? { unit: normalizedUnit }
        : raw.unit !== undefined
          ? { unit: raw.unit }
          : {}),
      ...(raw.progressMode !== undefined
        ? { progressMode: raw.progressMode }
        : {}),
      ...(raw.sortOrder !== undefined ? { sortOrder: raw.sortOrder } : {}),
    };
    const updated = await db.updateKeyResult(
      kr.id,
      patch,
      ctx.userId,
      editReason,
    );
    if (!updated) throw new NotFoundError();
    await db.recomputeObjectiveProgress(kr.objectiveId);
    return updated;
  },
});

export const DELETE = withAuth<undefined, { keyResultId: string }>({
  handler: async ({ ctx, db, params }) => {
    const kr = await db.getKeyResultById(params.keyResultId);
    if (!kr) throw new NotFoundError();
    const isOwner = kr.ownerUserId === ctx.userId;
    if (!isOwner && !can(ctx.role, "team.manage")) {
      throw new ForbiddenError("Only the owner or an admin can delete");
    }
    await db.softDeleteKeyResult(kr.id);
    await db.recomputeObjectiveProgress(kr.objectiveId);
    return { deleted: true };
  },
});
