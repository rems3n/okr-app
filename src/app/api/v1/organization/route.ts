import { eq } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { db as rawDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";

export const GET = withAuth({
  handler: async ({ db }) => {
    const org = await db.getOrganization();
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  },
});

const PatchInput = z.object({
  companySize: z.enum(["1-10", "11-25", "26-50", "50+"]).optional(),
  industry: z.string().max(80).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const PATCH = withAuth({
  require: "org.manage",
  input: PatchInput,
  handler: async ({ ctx, db, input }) => {
    const org = await db.getOrganization();
    if (!org) throw new NotFoundError("Organization not found");
    if (Object.keys(input).length === 0) return org;
    const [updated] = await rawDb
      .update(organizations)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(organizations.id, ctx.orgId))
      .returning();
    return updated ?? org;
  },
});
