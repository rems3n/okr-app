import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";

const InviteInput = z.object({
  email: z.email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const POST = withAuth<z.infer<typeof InviteInput>>({
  require: "member.invite",
  input: InviteInput,
  handler: async ({ ctx, input }) => {
    const client = await clerkClient();
    try {
      const invitation =
        await client.organizations.createOrganizationInvitation({
          organizationId: ctx.clerkOrgId,
          inviterUserId: ctx.clerkUserId,
          emailAddress: input.email,
          role: input.role === "admin" ? "org:admin" : "org:member",
        });
      return {
        id: invitation.id,
        email: invitation.emailAddress,
        status: invitation.status,
        role: invitation.role,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invitation failed";
      throw new BadRequestError(message);
    }
  },
});
