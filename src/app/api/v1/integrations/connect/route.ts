import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";
import { getProvider } from "@/lib/integrations/catalog";
import { getNango, nangoConnectionId } from "@/lib/integrations/nango";

const Input = z.object({
  provider: z.string(),
});

/**
 * Returns a Nango Connect session token the client uses to launch the OAuth
 * flow. The resulting connection is keyed as `{orgId}_{provider}` so our
 * webhook handler can decode org context without a lookup.
 */
export const POST = withAuth<z.infer<typeof Input>>({
  require: "integrations.connect",
  input: Input,
  handler: async ({ ctx, input }) => {
    const provider = getProvider(input.provider);
    if (!provider) throw new BadRequestError("Unknown provider");
    if (!provider.enabled)
      throw new BadRequestError(
        `${provider.label} is not yet available — coming soon.`,
      );
    const nango = getNango();
    if (!nango) throw new BadRequestError("Nango is not configured");

    // Nango assigns the actual connection_id once OAuth completes; we persist
    // the row in the `nango-session-callback` route using whatever Nango
    // returns to the client via the Connect UI.
    const session = await nango.createConnectSession({
      allowed_integrations: [provider.key],
      end_user: {
        id: ctx.userId,
        email: ctx.email,
        display_name: ctx.name,
      },
      organization: {
        id: ctx.orgId,
      },
    });

    return {
      sessionToken: session.data.token,
      provider: provider.key,
      connectionIdHint: nangoConnectionId(ctx.orgId, provider.key),
    };
  },
});
