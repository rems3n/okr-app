import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const PatchInput = z.object({
  body: z.string().min(1).max(10000),
  mentionedUserIds: z.array(z.uuid()).default([]),
});

export const PATCH = withAuth<z.infer<typeof PatchInput>, { id: string }>({
  input: PatchInput,
  handler: async ({ ctx, db, params, input }) => {
    const row = await db.updateComment(
      params.id,
      ctx.userId,
      input.body,
      input.mentionedUserIds,
    );
    if (!row) throw new ForbiddenError("Cannot edit this comment");
    return row;
  },
});

export const DELETE = withAuth<undefined, { id: string }>({
  handler: async ({ ctx, db, params }) => {
    const row = await db.deleteComment(params.id, ctx.userId);
    if (!row) throw new NotFoundError();
    return { deleted: true };
  },
});
