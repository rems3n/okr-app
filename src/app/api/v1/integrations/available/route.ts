import { withAuth } from "@/lib/api/with-auth";
import { PROVIDERS } from "@/lib/integrations/catalog";

export const GET = withAuth({
  handler: async ({ db }) => {
    const connected = await db.listConnectedIntegrations();
    const byProvider = new Map(connected.map((c) => [c.provider, c]));
    return PROVIDERS.map((p) => ({
      ...p,
      connection: byProvider.get(p.key)
        ? {
            id: byProvider.get(p.key)!.id,
            status: byProvider.get(p.key)!.status,
            lastSyncedAt: byProvider.get(p.key)!.lastSyncedAt,
            errorMessage: byProvider.get(p.key)!.errorMessage,
          }
        : null,
    }));
  },
});
