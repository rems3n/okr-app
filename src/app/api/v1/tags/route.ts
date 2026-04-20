import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";

export const GET = withAuth({
  handler: async ({ db }) => {
    return db.listTags();
  },
});

const CreateInput = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6B7280"),
});

export const POST = withAuth<z.infer<typeof CreateInput>>({
  require: "org.manage",
  input: CreateInput,
  handler: async ({ db, input }) => {
    return db.createTag({ name: input.name, color: input.color });
  },
});
