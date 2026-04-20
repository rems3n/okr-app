import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

export const GET = withAuth<undefined, { userId: string }>({
  handler: async ({ db, params }) => {
    return db.getCurrentManager(params.userId);
  },
});

const PostInput = z.object({
  managerUserId: z.uuid(),
});

export const POST = withAuth<
  z.infer<typeof PostInput>,
  { userId: string }
>({
  require: "manager.assign",
  input: PostInput,
  handler: async ({ db, params, input }) => {
    const row = await db.setManager(params.userId, input.managerUserId);
    if (!row) {
      throw new BadRequestError(
        "Cannot assign manager (invalid user, or user cannot manage themselves)",
      );
    }
    return row;
  },
});

export const DELETE = withAuth<undefined, { userId: string }>({
  require: "manager.assign",
  handler: async ({ db, params }) => {
    await db.clearManager(params.userId);
    return { cleared: true };
  },
});
