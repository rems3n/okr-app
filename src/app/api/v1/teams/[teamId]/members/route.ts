import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

export const GET = withAuth<undefined, { teamId: string }>({
  handler: async ({ db, params }) => {
    return db.listTeamMemberships(params.teamId);
  },
});

const AddInput = z.object({
  userId: z.uuid(),
  isLead: z.boolean().optional(),
});

export const POST = withAuth<z.infer<typeof AddInput>, { teamId: string }>({
  require: "team.manage",
  input: AddInput,
  handler: async ({ db, params, input }) => {
    const row = await db.addTeamMember(
      params.teamId,
      input.userId,
      input.isLead ?? false,
    );
    if (!row) throw new BadRequestError("Invalid team or user");
    return row;
  },
});

const DeleteInput = z.object({
  userId: z.uuid(),
});

export const DELETE = withAuth<
  z.infer<typeof DeleteInput>,
  { teamId: string }
>({
  require: "team.manage",
  input: DeleteInput,
  handler: async ({ db, params, input }) => {
    await db.removeTeamMember(params.teamId, input.userId);
    return { removed: true };
  },
});
