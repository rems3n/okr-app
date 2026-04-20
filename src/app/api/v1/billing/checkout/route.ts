import { eq } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { PRICE_IDS, PUBLIC_APP_URL, getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { BadRequestError } from "@/lib/errors";

const Input = z.object({
  priceKey: z.enum([
    "starter_monthly",
    "starter_annual",
    "growth_monthly",
    "growth_annual",
  ]),
});

/**
 * Creates a Stripe Checkout session scoped to this org. Returns a URL the
 * client redirects to. On success Stripe redirects back to /settings/billing
 * and the `checkout.session.completed` webhook persists the subscription.
 */
export const POST = withAuth<z.infer<typeof Input>>({
  require: "org.billing",
  input: Input,
  handler: async ({ ctx, input }) => {
    const stripe = getStripe();
    if (!stripe) throw new BadRequestError("Stripe is not configured");
    const priceId = PRICE_IDS[input.priceKey];
    if (!priceId) {
      throw new BadRequestError(
        `No Stripe price configured for ${input.priceKey}. Set STRIPE_PRICE_${input.priceKey.toUpperCase()}.`,
      );
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    if (!org) throw new BadRequestError("Organization not found");

    // Ensure there's a Stripe customer for this org.
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { organization_id: org.id, clerk_org_id: org.clerkOrgId },
      });
      customerId = customer.id;
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id));
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${PUBLIC_APP_URL()}/settings/billing?checkout=success`,
      cancel_url: `${PUBLIC_APP_URL()}/settings/billing?checkout=cancelled`,
      client_reference_id: org.id,
      subscription_data: {
        metadata: { organization_id: org.id, clerk_org_id: org.clerkOrgId },
      },
    });

    if (!session.url) {
      throw new BadRequestError("Stripe did not return a checkout URL");
    }
    return { url: session.url };
  },
});
