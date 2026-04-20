import type { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { handleClerkEvent } from "@/lib/webhooks/clerk-handlers";
import { verifySvix } from "@/lib/webhooks/verify-svix";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const rawBody = await req.text();
  const headerList = await headers();

  let event: WebhookEvent;
  try {
    event = verifySvix<WebhookEvent>(secret, rawBody, {
      id: headerList.get("svix-id"),
      timestamp: headerList.get("svix-timestamp"),
      signature: headerList.get("svix-signature"),
    });
  } catch {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    await handleClerkEvent(event);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Clerk webhook handler failed", { type: event.type, err });
    // Returning 500 lets Clerk retry with exponential backoff.
    return new NextResponse("Handler error", { status: 500 });
  }
}
