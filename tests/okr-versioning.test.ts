import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import { scopedDb } from "@/lib/db/scoped";
import {
  cycles,
  keyResultVersions,
  objectiveVersions,
  organizations,
  users,
} from "@/lib/db/schema";

import { createTestDb } from "./helpers/test-db";

async function seedOrg() {
  const { db, cleanup } = await createTestDb();
  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: "org_v", name: "V", slug: "v" })
    .returning();
  const [alice] = await db
    .insert(users)
    .values({
      clerkUserId: "u_a",
      organizationId: org.id,
      email: "a@a.com",
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
      status: "planning",
    })
    .returning();
  return { db, cleanup, org, alice, cycle, scoped: scopedDb(org.id, db) };
}

describe("objective versioning", () => {
  it("create writes v1, edit to title writes v2, non-versioned edit does not", async () => {
    const { db, cleanup, alice, cycle, scoped } = await seedOrg();
    try {
      const obj = await scoped.createObjective(
        {
          cycleId: cycle.id,
          ownerUserId: alice.id,
          title: "First",
          description: null,
          teamId: null,
          parentObjectiveId: null,
          status: "draft",
        },
        alice.id,
      );
      let versions = await db
        .select()
        .from(objectiveVersions)
        .where(eq(objectiveVersions.objectiveId, obj.id))
        .orderBy(asc(objectiveVersions.versionNumber));
      expect(versions).toHaveLength(1);
      expect(versions[0].title).toBe("First");

      await scoped.updateObjective(
        obj.id,
        { title: "Second" },
        alice.id,
        "name change",
      );
      versions = await db
        .select()
        .from(objectiveVersions)
        .where(eq(objectiveVersions.objectiveId, obj.id))
        .orderBy(asc(objectiveVersions.versionNumber));
      expect(versions).toHaveLength(2);
      expect(versions[1].title).toBe("Second");
      expect(versions[1].editReason).toBe("name change");

      // Updating progress is not a versioned field — no new version row.
      await scoped.updateObjective(
        obj.id,
        { progress: "42.00" },
        alice.id,
      );
      versions = await db
        .select()
        .from(objectiveVersions)
        .where(eq(objectiveVersions.objectiveId, obj.id));
      expect(versions).toHaveLength(2);
    } finally {
      await cleanup();
    }
  });
});

describe("key result versioning", () => {
  it("creating + editing target writes versions", async () => {
    const { db, cleanup, alice, cycle, scoped } = await seedOrg();
    try {
      const obj = await scoped.createObjective(
        {
          cycleId: cycle.id,
          ownerUserId: alice.id,
          title: "O",
          description: null,
          teamId: null,
          parentObjectiveId: null,
          status: "draft",
        },
        alice.id,
      );
      const kr = await scoped.createKeyResult(
        {
          objectiveId: obj.id,
          ownerUserId: alice.id,
          title: "KR 1",
          krType: "number",
          startValue: "0",
          targetValue: "10",
          currentValue: "0",
          unit: "issues",
        },
        alice.id,
      );
      expect(kr).not.toBeNull();
      let versions = await db
        .select()
        .from(keyResultVersions)
        .where(eq(keyResultVersions.keyResultId, kr!.id));
      expect(versions).toHaveLength(1);

      await scoped.updateKeyResult(
        kr!.id,
        { targetValue: "20" },
        alice.id,
        "stretched target after Q1 learning",
      );
      versions = await db
        .select()
        .from(keyResultVersions)
        .where(eq(keyResultVersions.keyResultId, kr!.id))
        .orderBy(asc(keyResultVersions.versionNumber));
      expect(versions).toHaveLength(2);
      expect(versions[1].editReason).toBe(
        "stretched target after Q1 learning",
      );

      // current_value change does NOT create a version.
      await scoped.updateKeyResult(
        kr!.id,
        { currentValue: "5" },
        alice.id,
      );
      versions = await db
        .select()
        .from(keyResultVersions)
        .where(eq(keyResultVersions.keyResultId, kr!.id));
      expect(versions).toHaveLength(2);
    } finally {
      await cleanup();
    }
  });
});

describe("objective progress recompute", () => {
  it("rolls KR current_value into objective.progress", async () => {
    const { cleanup, alice, cycle, scoped } = await seedOrg();
    try {
      const obj = await scoped.createObjective(
        {
          cycleId: cycle.id,
          ownerUserId: alice.id,
          title: "O",
          description: null,
          teamId: null,
          parentObjectiveId: null,
          status: "draft",
        },
        alice.id,
      );
      const kr = await scoped.createKeyResult(
        {
          objectiveId: obj.id,
          ownerUserId: alice.id,
          title: "KR 1",
          krType: "number",
          startValue: "0",
          targetValue: "10",
          currentValue: "0",
          unit: "items",
        },
        alice.id,
      );
      await scoped.updateKeyResult(
        kr!.id,
        { currentValue: "7" },
        alice.id,
      );
      const recomputed = await scoped.recomputeObjectiveProgress(obj.id);
      expect(Number(recomputed!.progress)).toBe(70);
    } finally {
      await cleanup();
    }
  });
});
