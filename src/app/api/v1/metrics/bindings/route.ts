import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

const CreateInput = z.object({
  keyResultId: z.uuid(),
  integrationConnectedId: z.uuid(),
  metricDefinitionId: z.uuid(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  require: "integrations.connect",
  input: CreateInput,
  handler: async ({ ctx, db, input }) => {
    const row = await db.createMetricBinding({
      keyResultId: input.keyResultId,
      integrationConnectedId: input.integrationConnectedId,
      metricDefinitionId: input.metricDefinitionId,
      config: input.config,
      createdByUserId: ctx.userId,
    });
    if (!row) throw new BadRequestError("Invalid KR or integration");
    return row;
  },
});
