import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { BadRequestError } from "@/lib/errors";
import { getProvider } from "@/lib/integrations/catalog";

const Input = z.object({
  provider: z.string(),
  connectionId: z.string().min(1),
});

/**
 * Called from the client after Nango Connect completes successfully. Records
 * the integrations_connected row in our DB. We trust the connectionId
 * returned by the Connect UI — the OAuth handshake itself was verified by
 * Nango before the UI surfaces it.
 */
export const POST = withAuth<z.infer<typeof Input>>({
  require: "integrations.connect",
  input: Input,
  handler: async ({ ctx, db, input }) => {
    const provider = getProvider(input.provider);
    if (!provider) throw new BadRequestError("Unknown provider");
    if (!provider.enabled) {
      throw new BadRequestError(
        `${provider.label} is not yet available — coming soon.`,
      );
    }
    const row = await db.upsertIntegration({
      provider: provider.key,
      nangoConnectionId: input.connectionId,
      status: "active",
      connectedByUserId: ctx.userId,
    });
    return row;
  },
});
