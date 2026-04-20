import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError, NotFoundError } from "@/lib/errors";

export const GET = withAuth<undefined, { cycleId: string }>({
  handler: async ({ db, params }) => {
    const cycle = await db.getCycleById(params.cycleId);
    if (!cycle) throw new NotFoundError();
    return cycle;
  },
});

const PatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  status: z.enum(["planning", "active", "grading", "closed"]).optional(),
});

// Only forward transitions (plus admin reopen grading↔closed) are allowed.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  planning: ["active"],
  active: ["grading"],
  grading: ["closed", "active"],
  closed: ["grading"],
};

export const PATCH = withAuth<
  z.infer<typeof PatchInput>,
  { cycleId: string }
>({
  require: "org.manage",
  input: PatchInput,
  handler: async ({ db, params, input }) => {
    const cycle = await db.getCycleById(params.cycleId);
    if (!cycle) throw new NotFoundError();

    if (input.status && input.status !== cycle.status) {
      const allowed = ALLOWED_TRANSITIONS[cycle.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new BadRequestError(
          `Cannot transition cycle from ${cycle.status} to ${input.status}`,
        );
      }
      if (input.status === "active") {
        const existing = await db.getActiveCycle();
        if (existing && existing.id !== cycle.id) {
          throw new BadRequestError(
            `Only one cycle can be active at a time. "${existing.name}" is currently active — move it to grading first.`,
          );
        }
      }
      if (input.status === "closed") {
        const coverage = await db.scoreCoverageForCycle(cycle.id);
        if (coverage.unscoredKrIds.length > 0) {
          throw new BadRequestError(
            `Cannot close: ${coverage.unscoredKrIds.length} of ${coverage.total} KRs still need a score. Grade them or reopen to active.`,
          );
        }
      }
    }

    if (
      input.startDate &&
      input.endDate &&
      input.startDate >= input.endDate
    ) {
      throw new BadRequestError("endDate must be after startDate");
    }

    const updated = await db.updateCycle(params.cycleId, input);
    if (!updated) throw new NotFoundError();
    return updated;
  },
});
