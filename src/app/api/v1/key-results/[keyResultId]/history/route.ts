import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth<undefined, { keyResultId: string }>({
  handler: async ({ db, params }) => {
    return db.listMetricValues(params.keyResultId);
  },
});
