import { withAuth } from "@/lib/api/with-auth";

export const DELETE = withAuth<undefined, { id: string }>({
  require: "integrations.connect",
  handler: async ({ db, params }) => {
    await db.deleteMetricBinding(params.id);
    return { deleted: true };
  },
});
