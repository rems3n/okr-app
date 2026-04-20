import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth<undefined, { objectiveId: string }>({
  handler: async ({ db, params }) => {
    return db.listObjectiveVersions(params.objectiveId);
  },
});
