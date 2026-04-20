import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import type { Plan } from "@/lib/billing/plans";

/**
 * Maps a Stripe price ID back to our internal plan key. Configure via env
 * vars so the mapping stays in one place and matches the Checkout flow.
 */
function planFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  const starter = [
    process.env.STRIPE_PRICE_STARTER_MONTHLY,
    process.env.STRIPE_PRICE_STARTER_ANNUAL,
  ].filter(Boolean);
  const growth = [
    process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    process.env.STRIPE_PRICE_GROWTH_ANNUAL,
  ].filter(Boolean);
  if (growth.includes(priceId)) return "growth";
  if (starter.includes(priceId)) return "starter";
  return "free";
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const orgId =
    (sub.metadata?.organization_id as string | undefined) ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = planFromPriceId(priceId);
  const isActive = sub.status === "active" || sub.status === "trialing";

  const conditions = orgId
    ? eq(organizations.id, orgId)
    : eq(organizations.stripeCustomerId, customerId);

  await db
    .update(organizations)
    .set({
      plan: isActive ? plan : "free",
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    })
    .where(conditions);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && typeof session.subscription !== "string") {
        await upsertFromSubscription(session.subscription);
      } else if (session.subscription) {
        // Fetch full subscription when Stripe only returned the ID.
        const Stripe = (await import("stripe")).default;
        const client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
        const sub = await client.subscriptions.retrieve(
          session.subscription,
        );
        await upsertFromSubscription(sub);
      }
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      return;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      // For Sprint 9 we don't act on these beyond logging — subscription
      // state handles plan gating via the "active/past_due" status above.
      return;
    default:
      return;
  }
}
