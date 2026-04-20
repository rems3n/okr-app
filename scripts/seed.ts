/**
 * Seeds demo data into the first organization in the database.
 *
 * Idempotent: checks for a seed marker cycle before doing anything.
 * Safe to rerun; will no-op after the first successful run.
 *
 * Usage (local):        DATABASE_URL=... pnpm db:seed
 * Usage (Railway live): railway run -s okr-app pnpm db:seed
 */

import { asc, eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "../src/lib/db/schema";
import { scopedDb } from "../src/lib/db/scoped";

const SEED_CYCLE_NAME = "Q2 2026 (demo)";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { prepare: false, max: 2 });
  const db = drizzle(client, { schema });

  try {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .orderBy(asc(schema.organizations.createdAt))
      .limit(1);
    if (!org) {
      throw new Error(
        "No organization found. Sign up once through the web app first.",
      );
    }
    console.log(`Seeding into org "${org.name}" (${org.id})`);

    const orgUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.organizationId, org.id))
      .orderBy(asc(schema.users.createdAt));
    if (orgUsers.length === 0) {
      throw new Error("Org has no users. Sign up first.");
    }
    const owner = orgUsers[0];
    console.log(
      `Owner: ${owner.name} <${owner.email}> (id=${owner.id})`,
    );

    const scoped = scopedDb(org.id, db as unknown as Parameters<typeof scopedDb>[1]);

    const existingCycles = await db
      .select()
      .from(schema.cycles)
      .where(eq(schema.cycles.organizationId, org.id));
    if (existingCycles.some((c) => c.name === SEED_CYCLE_NAME)) {
      console.log(
        `Seed already present (cycle "${SEED_CYCLE_NAME}" exists). No-op.`,
      );
      return;
    }

    // Park any already-active cycle so we can promote ours cleanly.
    for (const c of existingCycles) {
      if (c.status === "active") {
        await db
          .update(schema.cycles)
          .set({ status: "planning" })
          .where(eq(schema.cycles.id, c.id));
        console.log(`Demoted existing active cycle "${c.name}" to planning`);
      }
    }

    // Teams (idempotent per-name).
    const teamNames = ["Product", "Engineering", "Go-to-Market"];
    const teamMap: Record<string, string> = {};
    for (const name of teamNames) {
      const existing = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.organizationId, org.id));
      const found = existing.find((t) => t.name === name);
      if (found) {
        teamMap[name] = found.id;
        continue;
      }
      const team = await scoped.createTeam({ name });
      teamMap[name] = team.id;
      await scoped.addTeamMember(team.id, owner.id, true);
      console.log(`Created team "${name}"`);
    }

    // Cycle: active, covering a current-ish range so pace has something to show.
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 45);
    const end = new Date(today);
    end.setDate(end.getDate() + 45);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const cycle = await scoped.createCycle({
      name: SEED_CYCLE_NAME,
      startDate: fmt(start),
      endDate: fmt(end),
      status: "active",
    });
    console.log(`Created cycle "${cycle.name}" (${cycle.id}) — active`);

    // Company-level objectives.
    const company: Array<{
      id: string;
      title: string;
      krs: Array<{
        title: string;
        krType: "number" | "percentage" | "currency" | "milestone";
        startValue: number;
        targetValue: number;
        currentValue: number;
        unit?: string;
      }>;
    }> = [
      {
        id: "",
        title: "Reach $1M ARR",
        krs: [
          {
            title: "Grow MRR from $50k to $85k",
            krType: "currency",
            startValue: 50000,
            targetValue: 85000,
            currentValue: 62000,
            unit: "$",
          },
          {
            title: "Close 8 Series A deals",
            krType: "number",
            startValue: 0,
            targetValue: 8,
            currentValue: 3,
            unit: "deals",
          },
          {
            title: "Reduce churn to 3%",
            krType: "percentage",
            startValue: 6,
            targetValue: 3,
            currentValue: 4.5,
            unit: "%",
          },
        ],
      },
      {
        id: "",
        title: "Ship a product that users love",
        krs: [
          {
            title: "NPS from 22 → 45",
            krType: "number",
            startValue: 22,
            targetValue: 45,
            currentValue: 31,
            unit: "nps",
          },
          {
            title: "Onboarding time-to-first-value under 10 min",
            krType: "number",
            startValue: 22,
            targetValue: 10,
            currentValue: 14,
            unit: "min",
          },
          {
            title: "Launch OKR tree view",
            krType: "milestone",
            startValue: 0,
            targetValue: 100,
            currentValue: 0,
          },
        ],
      },
      {
        id: "",
        title: "Make the team faster",
        krs: [
          {
            title: "Ship 50 Linear issues per cycle",
            krType: "number",
            startValue: 0,
            targetValue: 50,
            currentValue: 28,
            unit: "issues",
          },
          {
            title: "Deployments per week",
            krType: "number",
            startValue: 2,
            targetValue: 8,
            currentValue: 5,
            unit: "/wk",
          },
        ],
      },
    ];

    for (const obj of company) {
      const created = await scoped.createObjective(
        {
          cycleId: cycle.id,
          ownerUserId: owner.id,
          title: obj.title,
          description: null,
          teamId: null,
          parentObjectiveId: null,
          status: "active",
        },
        owner.id,
      );
      obj.id = created.id;
      for (const kr of obj.krs) {
        const createdKr = await scoped.createKeyResult(
          {
            objectiveId: created.id,
            ownerUserId: owner.id,
            title: kr.title,
            krType: kr.krType,
            startValue: kr.startValue.toString(),
            targetValue: kr.targetValue.toString(),
            currentValue: kr.currentValue.toString(),
            unit: kr.unit ?? null,
          },
          owner.id,
        );
        if (!createdKr) throw new Error(`Failed to create KR: ${kr.title}`);
      }
      await scoped.recomputeObjectiveProgress(created.id);
      console.log(
        `  Objective "${obj.title}" with ${obj.krs.length} KRs`,
      );
    }

    // One team objective laddering to the first company objective, owned by Product.
    const teamObj = await scoped.createObjective(
      {
        cycleId: cycle.id,
        ownerUserId: owner.id,
        title: "Hit pipeline targets via self-serve",
        description: "Product-side contribution to ARR goal",
        teamId: teamMap["Product"],
        parentObjectiveId: company[0].id,
        status: "active",
      },
      owner.id,
    );
    await scoped.createKeyResult(
      {
        objectiveId: teamObj.id,
        ownerUserId: owner.id,
        title: "Activation rate 42% → 60%",
        krType: "percentage",
        startValue: "42",
        targetValue: "60",
        currentValue: "49",
        unit: "%",
      },
      owner.id,
    );
    await scoped.createKeyResult(
      {
        objectiveId: teamObj.id,
        ownerUserId: owner.id,
        title: "Weekly active teams 80 → 140",
        krType: "number",
        startValue: "80",
        targetValue: "140",
        currentValue: "110",
        unit: "teams",
      },
      owner.id,
    );
    await scoped.recomputeObjectiveProgress(teamObj.id);
    console.log(`  Team objective "${teamObj.title}" under Product`);

    console.log("Seed complete.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
