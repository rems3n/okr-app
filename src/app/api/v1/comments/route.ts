import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";
import { triggerWorkflow } from "@/lib/notifications/knock";

const ENTITY = z.enum(["objective", "key_result", "check_in"]);

const ListQuery = z.object({
  entityType: ENTITY,
  entityId: z.uuid(),
});

export const GET = withAuth<z.infer<typeof ListQuery>>({
  input: ListQuery,
  handler: async ({ db, input }) => {
    return db.listComments(input.entityType, input.entityId);
  },
});

const CreateInput = z.object({
  entityType: ENTITY,
  entityId: z.uuid(),
  body: z.string().min(1).max(10000),
  mentionedUserIds: z.array(z.uuid()).default([]),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  input: CreateInput,
  handler: async ({ ctx, db, input }) => {
    const row = await db.createComment({
      entityType: input.entityType,
      entityId: input.entityId,
      authorUserId: ctx.userId,
      body: input.body,
      mentionedUserIds: input.mentionedUserIds,
    });
    if (!row) throw new BadRequestError("Failed to create comment");

    // Notify mentioned users (excluding self-mentions). Awaited so test paths
    // see deterministic ordering, but the helper itself is best-effort.
    const recipients = input.mentionedUserIds.filter(
      (id) => id !== ctx.userId,
    );
    if (recipients.length > 0) {
      await triggerWorkflow("comment-mention", recipients, {
        actorName: ctx.name,
        entityType: input.entityType,
        entityId: input.entityId,
        bodyExcerpt: input.body.slice(0, 200),
        commentId: row.id,
      });
    }

    return row;
  },
});
