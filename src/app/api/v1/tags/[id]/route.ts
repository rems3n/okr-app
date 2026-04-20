import { withAuth } from "@/lib/api/with-auth";

export const DELETE = withAuth<undefined, { id: string }>({
  require: "org.manage",
  handler: async ({ db, params }) => {
    await db.deleteTag(params.id);
    return { deleted: true };
  },
});
