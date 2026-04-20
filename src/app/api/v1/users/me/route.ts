import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { NotFoundError } from "@/lib/errors";

export const GET = withAuth({
  handler: async ({ ctx, db }) => {
    const user = await db.getUserById(ctx.userId);
    if (!user) throw new NotFoundError();
    const manager = await db.getCurrentManager(ctx.userId);
    return { user, managerUserId: manager?.managerUserId ?? null };
  },
});

const PatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(80).optional(),
});

export const PATCH = withAuth({
  require: "profile.editOwn",
  input: PatchInput,
  handler: async ({ ctx, db, input }) => {
    const user = await db.updateUser(ctx.userId, input);
    if (!user) throw new NotFoundError();
    return user;
  },
});
