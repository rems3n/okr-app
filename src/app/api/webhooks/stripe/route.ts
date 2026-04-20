import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/webhooks/stripe-handlers";

export const runtime = "nodejs";

/**
 * Stripe verifies payload integrity via `stripe-signature`. We use the SDK's
 * `webhooks.constructEvent` helper for that — same envelope shape as our
 * Clerk/Nango receivers (read raw body → verify → enqueue/handle → 200).
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error("Stripe webhook not configured");
    return new NextResponse("Not configured", { status: 500 });
  }
  const rawBody = await req.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "verification failed";
    console.warn("Stripe signature verification failed:", message);
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    await handleStripeEvent(event);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Stripe handler failed", { type: event.type, err });
    return new NextResponse("Handler error", { status: 500 });
  }
}
