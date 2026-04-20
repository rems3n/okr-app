import { eq } from "drizzle-orm";

import { withAuth } from "@/lib/api/with-auth";
import { PUBLIC_APP_URL, getStripe } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { BadRequestError } from "@/lib/errors";

export const POST = withAuth({
  require: "org.billing",
  handler: async ({ ctx }) => {
    const stripe = getStripe();
    if (!stripe) throw new BadRequestError("Stripe is not configured");
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    if (!org) throw new BadRequestError("Organization not found");
    if (!org.stripeCustomerId) {
      throw new BadRequestError(
        "No subscription yet. Upgrade via Checkout first.",
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${PUBLIC_APP_URL()}/settings/billing`,
    });
    return { url: session.url };
  },
});
