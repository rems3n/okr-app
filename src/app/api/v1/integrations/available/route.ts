import { withAuth } from "@/lib/api/with-auth";
import { PROVIDERS } from "@/lib/integrations/catalog";
import { getNango } from "@/lib/integrations/nango";

export const GET = withAuth({
  handler: async ({ db }) => {
    const connected = await db.listConnectedIntegrations();
    const byProvider = new Map(connected.map((c) => [c.provider, c]));
    const providers = PROVIDERS.map((p) => ({
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
    return {
      providers,
      // Surface config status so the UI can prompt admins to finish Nango
      // setup instead of surfacing a cryptic server error on click.
      nangoConfigured:
        getNango() !== null &&
        Boolean(process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY),
    };
  },
});
