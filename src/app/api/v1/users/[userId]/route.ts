import { withAuth } from "@/lib/api/with-auth";
import { NotFoundError } from "@/lib/errors";

export const GET = withAuth<undefined, { userId: string }>({
  handler: async ({ db, params }) => {
    const user = await db.getUserById(params.userId);
    if (!user) throw new NotFoundError();
    const manager = await db.getCurrentManager(user.id);
    return { user, managerUserId: manager?.managerUserId ?? null };
  },
});
