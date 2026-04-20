import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

const ENTITY = z.enum(["objective", "key_result"]);

const Input = z.object({
  tagId: z.uuid(),
  entityType: ENTITY,
  entityId: z.uuid(),
});

export const POST = withAuth<z.infer<typeof Input>>({
  input: Input,
  handler: async ({ db, input }) => {
    const row = await db.applyTag(input.tagId, input.entityType, input.entityId);
    if (!row && row !== null) throw new BadRequestError("Failed");
    return { applied: true };
  },
});

export const DELETE = withAuth<z.infer<typeof Input>>({
  input: Input,
  handler: async ({ db, input }) => {
    await db.removeTag(input.tagId, input.entityType, input.entityId);
    return { removed: true };
  },
});
