import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key, {
    // Pin a stable API version so we don't get silent shape changes.
    apiVersion: "2026-03-25.dahlia",
  });
  return client;
}

export const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "",
  growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? "",
  growth_annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL ?? "",
};

export const PUBLIC_APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://okr-app-production-46c5.up.railway.app";
