import { Nango } from "@nangohq/node";

let client: Nango | null = null;

/**
 * Lazily constructs the Nango server SDK. Returns null when NANGO_SECRET_KEY
 * isn't set so builds (and dev without Nango configured) don't blow up.
 */
export function getNango(): Nango | null {
  if (client) return client;
  const secretKey = process.env.NANGO_SECRET_KEY;
  if (!secretKey) return null;
  client = new Nango({ secretKey });
  return client;
}

export function nangoConnectionId(orgId: string, provider: string): string {
  return `${orgId}_${provider}`;
}

export function parseConnectionId(
  connectionId: string,
): { orgId: string; provider: string } | null {
  const idx = connectionId.indexOf("_");
  if (idx <= 0) return null;
  return {
    orgId: connectionId.slice(0, idx),
    provider: connectionId.slice(idx + 1),
  };
}
