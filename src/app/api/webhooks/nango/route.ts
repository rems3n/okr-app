import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { inngest } from "@/lib/inngest/client";
import { verifyHmacSha256 } from "@/lib/webhooks/verify-hmac";

export const runtime = "nodejs";

/**
 * Nango webhook receiver. Signature-verify → enqueue Inngest event → 200.
 * All processing is async in src/inngest/process-nango-sync.ts.
 */
export async function POST(req: Request) {
  const secret = process.env.NANGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("NANGO_WEBHOOK_SECRET is not configured");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const headerList = await headers();
  const signature =
    headerList.get("x-nango-signature") ??
    headerList.get("x-signature") ??
    null;

  const valid = verifyHmacSha256({
    secret,
    rawBody,
    signature,
    style: "secret-prefixed",
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  await inngest.send({
    name: "nango/sync.completed",
    data: payload as Record<string, unknown>,
  });

  return new NextResponse("OK", { status: 200 });
}
