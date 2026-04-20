import { eq } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import { metricDefinitions } from "@/lib/db/schema";
import { ensureMetricDefinitionsSeeded } from "@/lib/db/seed-metric-definitions";

const Query = z.object({
  provider: z.string().optional(),
  enabledOnly: z.coerce.boolean().optional(),
});

export const GET = withAuth<z.infer<typeof Query>>({
  input: Query,
  handler: async ({ input }) => {
    await ensureMetricDefinitionsSeeded();
    const rows = await db
      .select()
      .from(metricDefinitions)
      .where(
        input.provider ? eq(metricDefinitions.provider, input.provider) : undefined,
      );
    return input.enabledOnly ? rows.filter((r) => r.enabled) : rows;
  },
});
