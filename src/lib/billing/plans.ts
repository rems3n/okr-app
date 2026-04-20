export type Plan = "free" | "starter" | "growth";

export type Feature =
  | "users"
  | "integrations"
  | "objectives"
  | "ai_drafts"
  | "sync_frequency";

export type PlanLimits = {
  users: number;
  integrations: number;
  objectives: number;
  ai_drafts: number;
  sync_frequency: "daily" | "hourly" | "15min";
};

export const UNLIMITED = -1;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    users: 5,
    integrations: 1,
    objectives: 5,
    ai_drafts: 3,
    sync_frequency: "daily",
  },
  starter: {
    users: 15,
    integrations: 3,
    objectives: 25,
    ai_drafts: UNLIMITED,
    sync_frequency: "hourly",
  },
  growth: {
    users: 50,
    integrations: 10,
    objectives: UNLIMITED,
    ai_drafts: UNLIMITED,
    sync_frequency: "15min",
  },
};

export function hasCapacity(plan: Plan, feature: "users" | "integrations" | "objectives" | "ai_drafts", current: number): boolean {
  const limit = PLAN_LIMITS[plan][feature];
  if (limit === UNLIMITED) return true;
  return current < limit;
}

export function limitFor(plan: Plan, feature: "users" | "integrations" | "objectives" | "ai_drafts"): number {
  return PLAN_LIMITS[plan][feature];
}

/**
 * Resolves the effective plan for an org. Trialing orgs on `free` get Starter
 * limits until trial_ends_at.
 */
export function effectivePlan(
  plan: Plan,
  trialEndsAt: Date | null,
): Plan {
  if (plan !== "free") return plan;
  if (trialEndsAt && trialEndsAt.getTime() > Date.now()) return "starter";
  return plan;
}
