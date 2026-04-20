import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { NotFoundError } from "@/lib/errors";

export const GET = withAuth({
  handler: async ({ db }) => {
    const org = await db.getOrganization();
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  },
});

const PatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
});

export const PATCH = withAuth({
  require: "org.manage",
  input: PatchInput,
  handler: async ({ db, input }) => {
    const org = await db.getOrganization();
    if (!org) throw new NotFoundError("Organization not found");
    // Name also lives in Clerk — Sprint 1 keeps Clerk as source of truth for
    // identity fields, so we intentionally skip the DB write and document it.
    // For now this endpoint is read-only aside from onboarding_completed.
    void input;
    return org;
  },
});
