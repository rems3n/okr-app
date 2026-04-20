import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import { scopedDb } from "@/lib/db/scoped";
import {
  checkIns,
  cycles,
  integrationsConnected,
  keyResults,
  metricBindings,
  metricDefinitions,
  metricValues,
  objectives,
  organizations,
  users,
} from "@/lib/db/schema";

import { createTestDb } from "./helpers/test-db";

async function seed() {
  const { db, cleanup } = await createTestDb();

  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: "org_m", name: "M", slug: "m" })
    .returning();
  const [alice] = await db
    .insert(users)
    .values({
      clerkUserId: "u_m_alice",
      organizationId: org.id,
      email: "a@m.com",
      name: "Alice",
      role: "admin",
    })
    .returning();
  const [cycle] = await db
    .insert(cycles)
    .values({
      organizationId: org.id,
      name: "Q2 2026",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      status: "active",
    })
    .returning();
  const [obj] = await db
    .insert(objectives)
    .values({
      organizationId: org.id,
      cycleId: cycle.id,
      ownerUserId: alice.id,
      title: "Ship fast",
      status: "active",
    })
    .returning();
  const [kr] = await db
    .insert(keyResults)
    .values({
      objectiveId: obj.id,
      ownerUserId: alice.id,
      title: "Issues completed",
      krType: "number",
      startValue: "0",
      targetValue: "50",
      currentValue: "0",
      unit: "issues",
    })
    .returning();
  const [integration] = await db
    .insert(integrationsConnected)
    .values({
      organizationId: org.id,
      provider: "linear",
      nangoConnectionId: `${org.id}_linear`,
      status: "active",
      connectedByUserId: alice.id,
    })
    .returning();
  const [definition] = await db
    .insert(metricDefinitions)
    .values({
      provider: "linear",
      key: "linear.issues_completed",
      label: "Issues completed",
      configSchema: {},
      nangoSyncName: "linear-issues-completed",
      outputUnit: "count",
      enabled: true,
    })
    .returning();
  const [binding] = await db
    .insert(metricBindings)
    .values({
      keyResultId: kr.id,
      integrationConnectedId: integration.id,
      metricDefinitionId: definition.id,
      config: { teamKey: "ENG" },
      createdByUserId: alice.id,
    })
    .returning();

  return {
    db,
    cleanup,
    org,
    alice,
    cycle,
    obj,
    kr,
    integration,
    definition,
    binding,
    scoped: scopedDb(org.id, db),
  };
}

describe("appendMetricValue → sync check-in pipeline", () => {
  it("writes metric_value + check_in(source=sync) + updates KR + recomputes objective", async () => {
    const env = await seed();
    try {
      const result = await env.scoped.appendMetricValue({
        keyResultId: env.kr.id,
        value: 12,
        authorUserId: env.alice.id,
      });
      expect(result).not.toBeNull();

      const [valueRow] = await env.db
        .select()
        .from(metricValues)
        .where(eq(metricValues.keyResultId, env.kr.id));
      expect(Number(valueRow.value)).toBe(12);

      const [ci] = await env.db
        .select()
        .from(checkIns)
        .where(eq(checkIns.keyResultId, env.kr.id))
        .orderBy(asc(checkIns.createdAt));
      expect(ci.source).toBe("sync");
      expect(ci.confidence).toBe("on_track"); // carry-forward default
      expect(Number(ci.newValue)).toBe(12);
      expect(Number(ci.previousValue)).toBe(0);

      const [krAfter] = await env.db
        .select()
        .from(keyResults)
        .where(eq(keyResults.id, env.kr.id));
      expect(Number(krAfter.currentValue)).toBe(12);

      const [objAfter] = await env.db
        .select()
        .from(objectives)
        .where(eq(objectives.id, env.obj.id));
      // 12 / 50 = 24%
      expect(Number(objAfter.progress)).toBeCloseTo(24, 1);
    } finally {
      await env.cleanup();
    }
  });

  it("carries forward the most recent manual confidence when syncing", async () => {
    const env = await seed();
    try {
      // Simulate a prior manual at_risk check-in.
      await env.db.insert(checkIns).values({
        keyResultId: env.kr.id,
        authorUserId: env.alice.id,
        previousValue: "0",
        newValue: "3",
        confidence: "at_risk",
        source: "manual",
      });

      await env.scoped.appendMetricValue({
        keyResultId: env.kr.id,
        value: 7,
        authorUserId: env.alice.id,
      });

      const rows = await env.db
        .select()
        .from(checkIns)
        .where(eq(checkIns.keyResultId, env.kr.id));
      const sync = rows.find((r) => r.source === "sync");
      expect(sync?.confidence).toBe("at_risk");
    } finally {
      await env.cleanup();
    }
  });

  it("createMetricBinding rejects cross-org integrations", async () => {
    const env = await seed();
    try {
      // New org with its own integration.
      const [otherOrg] = await env.db
        .insert(organizations)
        .values({ clerkOrgId: "org_other", name: "Other", slug: "other" })
        .returning();
      const [bob] = await env.db
        .insert(users)
        .values({
          clerkUserId: "u_bob",
          organizationId: otherOrg.id,
          email: "b@o.com",
          name: "Bob",
          role: "admin",
        })
        .returning();
      const [otherIntegration] = await env.db
        .insert(integrationsConnected)
        .values({
          organizationId: otherOrg.id,
          provider: "linear",
          nangoConnectionId: `${otherOrg.id}_linear`,
          status: "active",
          connectedByUserId: bob.id,
        })
        .returning();

      // Alice (org M) tries to bind her KR to Bob's integration → should fail.
      const bad = await env.scoped.createMetricBinding({
        keyResultId: env.kr.id,
        integrationConnectedId: otherIntegration.id,
        metricDefinitionId: env.definition.id,
        config: {},
        createdByUserId: env.alice.id,
      });
      expect(bad).toBeNull();
    } finally {
      await env.cleanup();
    }
  });
});
