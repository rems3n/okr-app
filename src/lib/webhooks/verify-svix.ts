import { Webhook } from "svix";

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Verifies a Svix-signed webhook body. Used for Clerk now and for any future
 * Svix-backed webhook (Nango too). Returns the parsed event payload or throws.
 */
export function verifySvix<T = unknown>(
  secret: string,
  rawBody: string,
  headers: SvixHeaders,
): T {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Missing svix headers");
  }
  const wh = new Webhook(secret);
  return wh.verify(rawBody, {
    "svix-id": headers.id,
    "svix-timestamp": headers.timestamp,
    "svix-signature": headers.signature,
  }) as T;
}
