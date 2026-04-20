import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  integrationsConnected,
  keyResults,
  objectives,
  organizations,
  users,
} from "@/lib/db/schema";
import { BadRequestError } from "@/lib/errors";

import {
  effectivePlan,
  hasCapacity,
  limitFor,
  type Plan,
} from "./plans";

async function countUsers(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, orgId));
  return rows.length;
}

async function countObjectives(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: objectives.id })
    .from(objectives)
    .where(
      and(eq(objectives.organizationId, orgId), isNull(objectives.deletedAt)),
    );
  return rows.length;
}

async function countKeyResults(orgId: string): Promise<number> {
  // Not gated directly, but useful context if we later expose it.
  const rows = await db
    .select({ id: keyResults.id })
    .from(keyResults)
    .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
    .where(
      and(
        eq(objectives.organizationId, orgId),
        isNull(keyResults.deletedAt),
        isNull(objectives.deletedAt),
      ),
    );
  return rows.length;
}

async function countIntegrations(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: integrationsConnected.id })
    .from(integrationsConnected)
    .where(
      and(
        eq(integrationsConnected.organizationId, orgId),
        eq(integrationsConnected.status, "active"),
      ),
    );
  return rows.length;
}

export type PlanGuardInput =
  | { kind: "users" }
  | { kind: "objectives" }
  | { kind: "integrations" };

/**
 * Throws BadRequestError with a structured upgrade payload when the
 * organization is at its plan limit for the given resource kind.
 * Call just before you create a new row of that kind.
 *
 * Trial orgs get starter limits (see effectivePlan).
 */
export async function requireCapacity(
  orgId: string,
  input: PlanGuardInput,
): Promise<void> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return; // Org missing? Let the caller surface its own error.
  const plan = effectivePlan(
    org.plan as Plan,
    org.trialEndsAt ? new Date(org.trialEndsAt) : null,
  );

  let current: number;
  let feature: "users" | "objectives" | "integrations";
  switch (input.kind) {
    case "users":
      current = await countUsers(orgId);
      feature = "users";
      break;
    case "objectives":
      current = await countObjectives(orgId);
      feature = "objectives";
      break;
    case "integrations":
      current = await countIntegrations(orgId);
      feature = "integrations";
      break;
  }

  if (!hasCapacity(plan, feature, current)) {
    throw new BadRequestError(
      `Plan limit reached: ${feature} (${current}/${limitFor(plan, feature)}). Upgrade to add more.`,
    );
  }
}

export { countUsers, countObjectives, countKeyResults, countIntegrations };
