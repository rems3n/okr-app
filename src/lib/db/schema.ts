import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "starter", "growth"] })
    .notNull()
    .default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["owner", "admin", "member"] })
    .notNull()
    .default("member"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isLead: boolean("is_lead").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("uq_team_memberships_team_user").on(t.teamId, t.userId)],
);

export const managerAssignments = pgTable(
  "manager_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    managerUserId: uuid("manager_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "ck_manager_not_self",
      sql`${t.userId} <> ${t.managerUserId}`,
    ),
    index("idx_manager_current")
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
  ],
);

export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status", {
      enum: ["planning", "active", "grading", "closed"],
    })
      .notNull()
      .default("planning"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_cycles_org_status").on(t.organizationId, t.status),
    uniqueIndex("uq_active_cycle_per_org")
      .on(t.organizationId)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const objectives = pgTable(
  "objectives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    parentObjectiveId: uuid("parent_objective_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["draft", "active", "closed"] })
      .notNull()
      .default("draft"),
    progress: numeric("progress", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_objectives_org_cycle").on(t.organizationId, t.cycleId),
    index("idx_objectives_parent").on(t.parentObjectiveId),
    index("idx_objectives_owner").on(t.ownerUserId),
  ],
);

export const keyResults = pgTable(
  "key_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    objectiveId: uuid("objective_id")
      .notNull()
      .references(() => objectives.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    krType: text("kr_type", {
      enum: ["number", "percentage", "currency", "milestone"],
    })
      .notNull()
      .default("number"),
    startValue: numeric("start_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull(),
    currentValue: numeric("current_value", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    unit: text("unit"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_kr_objective").on(t.objectiveId)],
);

export const objectiveVersions = pgTable(
  "objective_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    objectiveId: uuid("objective_id")
      .notNull()
      .references(() => objectives.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    parentObjectiveId: uuid("parent_objective_id"),
    teamId: uuid("team_id"),
    status: text("status").notNull(),
    editedByUserId: uuid("edited_by_user_id")
      .notNull()
      .references(() => users.id),
    editReason: text("edit_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_objective_version").on(t.objectiveId, t.versionNumber),
  ],
);

export const keyResultVersions = pgTable(
  "key_result_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyResultId: uuid("key_result_id")
      .notNull()
      .references(() => keyResults.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    krType: text("kr_type").notNull(),
    startValue: numeric("start_value", { precision: 18, scale: 4 }).notNull(),
    targetValue: numeric("target_value", { precision: 18, scale: 4 }).notNull(),
    unit: text("unit"),
    editedByUserId: uuid("edited_by_user_id")
      .notNull()
      .references(() => users.id),
    editReason: text("edit_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("uq_kr_version").on(t.keyResultId, t.versionNumber)],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type NewTeamMembership = typeof teamMemberships.$inferInsert;
export type ManagerAssignment = typeof managerAssignments.$inferSelect;
export type NewManagerAssignment = typeof managerAssignments.$inferInsert;
export type Cycle = typeof cycles.$inferSelect;
export type NewCycle = typeof cycles.$inferInsert;
export type Objective = typeof objectives.$inferSelect;
export type NewObjective = typeof objectives.$inferInsert;
export type KeyResult = typeof keyResults.$inferSelect;
export type NewKeyResult = typeof keyResults.$inferInsert;
export type ObjectiveVersion = typeof objectiveVersions.$inferSelect;
export type NewObjectiveVersion = typeof objectiveVersions.$inferInsert;
export type KeyResultVersion = typeof keyResultVersions.$inferSelect;
export type NewKeyResultVersion = typeof keyResultVersions.$inferInsert;
