import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export type ServerEventProps = Record<string, string | number | boolean | null>;

export async function captureServer(
  distinctId: string,
  event: string,
  properties: ServerEventProps = {},
  groups: { organization?: string } = {},
) {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties, groups });
  await ph.flush();
}
