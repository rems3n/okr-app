import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth<undefined, { cycleId: string }>({
  handler: async ({ db, params }) => {
    const [rows, coverage] = await Promise.all([
      db.listScoresForCycle(params.cycleId),
      db.scoreCoverageForCycle(params.cycleId),
    ]);
    return { scores: rows, coverage };
  },
});
