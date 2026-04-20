import { withAuth } from "@/lib/api/with-auth";
import { NotFoundError } from "@/lib/errors";
import { getNango } from "@/lib/integrations/nango";

export const GET = withAuth<undefined, { id: string }>({
  handler: async ({ db, params }) => {
    const integration = await db.getIntegrationById(params.id);
    if (!integration) throw new NotFoundError();
    return integration;
  },
});

export const DELETE = withAuth<undefined, { id: string }>({
  require: "integrations.connect",
  handler: async ({ db, params }) => {
    const integration = await db.getIntegrationById(params.id);
    if (!integration) throw new NotFoundError();
    const nango = getNango();
    if (nango) {
      try {
        await nango.deleteConnection(
          integration.provider,
          integration.nangoConnectionId,
        );
      } catch (err) {
        // Log but don't block — Nango might have already dropped the connection.
        console.warn("Nango deleteConnection failed", err);
      }
    }
    await db.disconnectIntegration(params.id);
    return { disconnected: true };
  },
});
