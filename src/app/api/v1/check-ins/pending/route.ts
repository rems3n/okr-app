import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";

const Query = z.object({
  cycleId: z.uuid().optional(),
  staleAfterDays: z.coerce.number().int().min(0).max(90).optional(),
});

/**
 * Lists the current user's KRs that need a check-in in the given cycle
 * (default: active cycle, default staleness threshold 7 days).
 */
export const GET = withAuth<z.infer<typeof Query>>({
  input: Query,
  handler: async ({ ctx, db, input }) => {
    let cycleId = input.cycleId;
    if (!cycleId) {
      const active = await db.getActiveCycle();
      cycleId = active?.id;
    }
    if (!cycleId) return [];
    return db.listKrsNeedingCheckIn(
      ctx.userId,
      cycleId,
      input.staleAfterDays ?? 7,
    );
  },
});
