import { getAuthContext } from "@/lib/auth/get-current-user";
import { effectivePlan, PLAN_LIMITS, type Plan } from "@/lib/billing/plans";
import { scopedDb } from "@/lib/db/scoped";
import { NotFoundError } from "@/lib/errors";

import { BillingClient } from "@/components/settings/billing-page";

function daysUntil(target: Date): number {
  const from = new Date();
  if (target.getTime() <= from.getTime()) return 0;
  return Math.ceil(
    (target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default async function Page() {
  const ctx = await getAuthContext();
  const db = scopedDb(ctx.orgId);
  const org = await db.getOrganization();
  if (!org) throw new NotFoundError();
  const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  const effective = effectivePlan(org.plan as Plan, trialEndsAt);
  const trialDaysLeft = trialEndsAt ? daysUntil(trialEndsAt) : 0;
  return (
    <BillingClient
      currentRole={ctx.role}
      plan={org.plan as Plan}
      effectivePlan={effective}
      trialDaysLeft={trialDaysLeft}
      hasSubscription={Boolean(org.stripeSubscriptionId)}
      limits={PLAN_LIMITS[effective]}
    />
  );
}
