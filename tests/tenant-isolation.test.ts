import { describe, expect, it } from "vitest";

import { scopedDb } from "@/lib/db/scoped";
import { organizations, users } from "@/lib/db/schema";

import { createTestDb } from "./helpers/test-db";

describe("tenant isolation", () => {
  it("scopedDb(orgA) cannot see org B data", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const [orgA, orgB] = await db
        .insert(organizations)
        .values([
          { clerkOrgId: "org_a", name: "Org A", slug: "org-a" },
          { clerkOrgId: "org_b", name: "Org B", slug: "org-b" },
        ])
        .returning();

      const [aliceA] = await db
        .insert(users)
        .values({
          clerkUserId: "user_alice",
          organizationId: orgA.id,
          email: "alice@a.com",
          name: "Alice",
          role: "admin",
        })
        .returning();

      const [bobB] = await db
        .insert(users)
        .values({
          clerkUserId: "user_bob",
          organizationId: orgB.id,
          email: "bob@b.com",
          name: "Bob",
          role: "admin",
        })
        .returning();

      const scopedA = scopedDb(orgA.id, db);
      const scopedB = scopedDb(orgB.id, db);

      const orgAUsers = await scopedA.listUsers();
      expect(orgAUsers.map((u) => u.id)).toEqual([aliceA.id]);

      const orgBUsers = await scopedB.listUsers();
      expect(orgBUsers.map((u) => u.id)).toEqual([bobB.id]);

      // Looking up Bob through org A's scope must return null even though the
      // row exists — this is the load-bearing guarantee for /api/v1/users/:id.
      expect(await scopedA.getUserById(bobB.id)).toBeNull();
      expect(await scopedA.getUserByClerkId("user_bob")).toBeNull();

      // Org A's organization getter should never return Org B.
      const orgFetchedByA = await scopedA.getOrganization();
      expect(orgFetchedByA?.id).toBe(orgA.id);
      expect(orgFetchedByA?.id).not.toBe(orgB.id);

      // Create a team in each org and confirm the listing doesn't bleed.
      const teamA = await scopedA.createTeam({ name: "Team A" });
      const teamB = await scopedB.createTeam({ name: "Team B" });
      expect(teamA).toBeTruthy();
      expect(teamB).toBeTruthy();

      const aTeams = await scopedA.listTeams();
      expect(aTeams.map((t) => t.name)).toEqual(["Team A"]);

      const bTeams = await scopedB.listTeams();
      expect(bTeams.map((t) => t.name)).toEqual(["Team B"]);

      // Cross-org delete must be a no-op.
      await scopedA.deleteTeam(teamB!.id);
      const stillThere = await scopedB.getTeamById(teamB!.id);
      expect(stillThere?.name).toBe("Team B");
    } finally {
      await cleanup();
    }
  });

  it("setManager rejects cross-org assignments", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const [orgA, orgB] = await db
        .insert(organizations)
        .values([
          { clerkOrgId: "org_a2", name: "Org A", slug: "org-a2" },
          { clerkOrgId: "org_b2", name: "Org B", slug: "org-b2" },
        ])
        .returning();

      const [alice] = await db
        .insert(users)
        .values({
          clerkUserId: "u_alice2",
          organizationId: orgA.id,
          email: "alice@a.com",
          name: "Alice",
          role: "member",
        })
        .returning();

      const [bob] = await db
        .insert(users)
        .values({
          clerkUserId: "u_bob2",
          organizationId: orgB.id,
          email: "bob@b.com",
          name: "Bob",
          role: "admin",
        })
        .returning();

      const scopedA = scopedDb(orgA.id, db);
      const crossOrg = await scopedA.setManager(alice.id, bob.id);
      expect(crossOrg).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
