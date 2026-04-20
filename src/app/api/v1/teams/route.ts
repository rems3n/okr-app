import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth({
  handler: async ({ db }) => {
    return db.listTeams();
  },
});

const CreateInput = z.object({
  name: z.string().min(1).max(120),
});

export const POST = withAuth({
  require: "team.create",
  input: CreateInput,
  handler: async ({ db, input }) => {
    return db.createTeam({ name: input.name });
  },
});
