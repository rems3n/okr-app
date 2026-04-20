import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { NotFoundError } from "@/lib/errors";

export const GET = withAuth<undefined, { teamId: string }>({
  handler: async ({ db, params }) => {
    const team = await db.getTeamById(params.teamId);
    if (!team) throw new NotFoundError();
    return team;
  },
});

const PatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
});

export const PATCH = withAuth<
  z.infer<typeof PatchInput>,
  { teamId: string }
>({
  require: "team.manage",
  input: PatchInput,
  handler: async ({ db, params, input }) => {
    const team = await db.updateTeam(params.teamId, input);
    if (!team) throw new NotFoundError();
    return team;
  },
});

export const DELETE = withAuth<undefined, { teamId: string }>({
  require: "team.delete",
  handler: async ({ db, params }) => {
    await db.deleteTeam(params.teamId);
    return { deleted: true };
  },
});
