import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db as defaultDb } from "./index";
import {
  cycles,
  keyResultVersions,
  keyResults,
  managerAssignments,
  objectiveVersions,
  objectives,
  organizations,
  teamMemberships,
  teams,
  users,
  type KeyResult,
  type NewCycle,
  type NewKeyResult,
  type NewObjective,
  type NewTeam,
  type NewUser,
  type Objective,
} from "./schema";
import { objectiveProgress } from "@/lib/okr/progress";
import {
  needsKrVersion,
  needsObjectiveVersion,
} from "@/lib/okr/versioning";

type AnyDb = typeof defaultDb;

/**
 * Returns a wrapper that forces every query to filter by `organizationId`.
 * Why: the app has no Postgres RLS. Isolation only holds because every route
 * hands off to scopedDb(orgId) instead of reaching for `db` directly.
 *
 * New tables extend this wrapper as they land.
 * An alternate db can be injected for tests (pg-mem).
 */
export function scopedDb(organizationId: string, db: AnyDb = defaultDb) {
  return {
    organizationId,

    // --- Organization ---
    async getOrganization() {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return row ?? null;
    },

    // --- Users ---
    async listUsers() {
      return db
        .select()
        .from(users)
        .where(eq(users.organizationId, organizationId));
    },

    async getUserByClerkId(clerkUserId: string) {
      const [row] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.organizationId, organizationId),
            eq(users.clerkUserId, clerkUserId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async getUserById(userId: string) {
      const [row] = await db
        .select()
        .from(users)
        .where(
          and(eq(users.organizationId, organizationId), eq(users.id, userId)),
        )
        .limit(1);
      return row ?? null;
    },

    async updateUser(userId: string, patch: Partial<NewUser>) {
      const [row] = await db
        .update(users)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(users.organizationId, organizationId), eq(users.id, userId)),
        )
        .returning();
      return row ?? null;
    },

    // --- Teams ---
    async listTeams() {
      return db
        .select()
        .from(teams)
        .where(eq(teams.organizationId, organizationId));
    },

    async getTeamById(teamId: string) {
      const [row] = await db
        .select()
        .from(teams)
        .where(
          and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)),
        )
        .limit(1);
      return row ?? null;
    },

    async createTeam(patch: Omit<NewTeam, "organizationId">) {
      const [row] = await db
        .insert(teams)
        .values({ ...patch, organizationId })
        .returning();
      return row;
    },

    async updateTeam(teamId: string, patch: Partial<NewTeam>) {
      const [row] = await db
        .update(teams)
        .set(patch)
        .where(
          and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)),
        )
        .returning();
      return row ?? null;
    },

    async deleteTeam(teamId: string) {
      await db
        .delete(teams)
        .where(
          and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)),
        );
    },

    // --- Team memberships ---
    async listTeamMemberships(teamId: string) {
      const team = await this.getTeamById(teamId);
      if (!team) return [];
      return db
        .select({
          id: teamMemberships.id,
          teamId: teamMemberships.teamId,
          userId: teamMemberships.userId,
          isLead: teamMemberships.isLead,
          createdAt: teamMemberships.createdAt,
          userName: users.name,
          userEmail: users.email,
          userAvatarUrl: users.avatarUrl,
        })
        .from(teamMemberships)
        .innerJoin(users, eq(users.id, teamMemberships.userId))
        .where(eq(teamMemberships.teamId, teamId));
    },

    async addTeamMember(teamId: string, userId: string, isLead = false) {
      // Confirm both belong to this org.
      const team = await this.getTeamById(teamId);
      const user = await this.getUserById(userId);
      if (!team || !user) return null;
      const [row] = await db
        .insert(teamMemberships)
        .values({ teamId, userId, isLead })
        .onConflictDoUpdate({
          target: [teamMemberships.teamId, teamMemberships.userId],
          set: { isLead },
        })
        .returning();
      return row;
    },

    async removeTeamMember(teamId: string, userId: string) {
      const team = await this.getTeamById(teamId);
      if (!team) return;
      await db
        .delete(teamMemberships)
        .where(
          and(
            eq(teamMemberships.teamId, teamId),
            eq(teamMemberships.userId, userId),
          ),
        );
    },

    // --- Manager assignments ---
    async getCurrentManager(userId: string) {
      const [row] = await db
        .select()
        .from(managerAssignments)
        .where(
          and(
            eq(managerAssignments.organizationId, organizationId),
            eq(managerAssignments.userId, userId),
            isNull(managerAssignments.endedAt),
          ),
        )
        .orderBy(desc(managerAssignments.startedAt))
        .limit(1);
      return row ?? null;
    },

    async setManager(userId: string, managerUserId: string) {
      if (userId === managerUserId) return null;
      const user = await this.getUserById(userId);
      const manager = await this.getUserById(managerUserId);
      if (!user || !manager) return null;

      return db.transaction(async (tx) => {
        await tx
          .update(managerAssignments)
          .set({ endedAt: new Date() })
          .where(
            and(
              eq(managerAssignments.organizationId, organizationId),
              eq(managerAssignments.userId, userId),
              isNull(managerAssignments.endedAt),
            ),
          );

        const [row] = await tx
          .insert(managerAssignments)
          .values({ organizationId, userId, managerUserId })
          .returning();
        return row;
      });
    },

    async clearManager(userId: string) {
      await db
        .update(managerAssignments)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(managerAssignments.organizationId, organizationId),
            eq(managerAssignments.userId, userId),
            isNull(managerAssignments.endedAt),
          ),
        );
    },

    // --- Cycles ---
    async listCycles() {
      return db
        .select()
        .from(cycles)
        .where(eq(cycles.organizationId, organizationId))
        .orderBy(desc(cycles.startDate));
    },

    async getCycleById(cycleId: string) {
      const [row] = await db
        .select()
        .from(cycles)
        .where(
          and(
            eq(cycles.organizationId, organizationId),
            eq(cycles.id, cycleId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async getActiveCycle() {
      const [row] = await db
        .select()
        .from(cycles)
        .where(
          and(
            eq(cycles.organizationId, organizationId),
            eq(cycles.status, "active"),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async createCycle(input: Omit<NewCycle, "organizationId">) {
      const [row] = await db
        .insert(cycles)
        .values({ ...input, organizationId })
        .returning();
      return row;
    },

    async updateCycle(cycleId: string, patch: Partial<NewCycle>) {
      const [row] = await db
        .update(cycles)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(cycles.organizationId, organizationId),
            eq(cycles.id, cycleId),
          ),
        )
        .returning();
      return row ?? null;
    },

    // --- Objectives ---
    async listObjectives(filter: {
      cycleId?: string;
      ownerUserId?: string;
      teamId?: string;
      parentObjectiveId?: string | null;
    } = {}) {
      const conds = [
        eq(objectives.organizationId, organizationId),
        isNull(objectives.deletedAt),
      ];
      if (filter.cycleId) conds.push(eq(objectives.cycleId, filter.cycleId));
      if (filter.ownerUserId)
        conds.push(eq(objectives.ownerUserId, filter.ownerUserId));
      if (filter.teamId) conds.push(eq(objectives.teamId, filter.teamId));
      if (filter.parentObjectiveId === null)
        conds.push(isNull(objectives.parentObjectiveId));
      else if (filter.parentObjectiveId)
        conds.push(eq(objectives.parentObjectiveId, filter.parentObjectiveId));
      return db
        .select()
        .from(objectives)
        .where(and(...conds))
        .orderBy(asc(objectives.createdAt));
    },

    async getObjectiveById(objectiveId: string) {
      const [row] = await db
        .select()
        .from(objectives)
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.id, objectiveId),
            isNull(objectives.deletedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async createObjective(
      input: Omit<NewObjective, "organizationId">,
      editedByUserId: string,
    ) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(objectives)
          .values({ ...input, organizationId })
          .returning();
        await tx.insert(objectiveVersions).values({
          objectiveId: row.id,
          versionNumber: 1,
          title: row.title,
          description: row.description,
          parentObjectiveId: row.parentObjectiveId,
          teamId: row.teamId,
          status: row.status,
          editedByUserId,
        });
        return row;
      });
    },

    async updateObjective(
      objectiveId: string,
      patch: Partial<NewObjective>,
      editedByUserId: string,
      editReason?: string,
    ) {
      return db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(objectives)
          .where(
            and(
              eq(objectives.organizationId, organizationId),
              eq(objectives.id, objectiveId),
              isNull(objectives.deletedAt),
            ),
          )
          .limit(1);
        if (!before) return null;
        const [after] = await tx
          .update(objectives)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(objectives.id, before.id))
          .returning();
        if (needsObjectiveVersion(before as Objective, patch as Partial<Objective>)) {
          const [prior] = await tx
            .select({ versionNumber: objectiveVersions.versionNumber })
            .from(objectiveVersions)
            .where(eq(objectiveVersions.objectiveId, before.id))
            .orderBy(desc(objectiveVersions.versionNumber))
            .limit(1);
          await tx.insert(objectiveVersions).values({
            objectiveId: before.id,
            versionNumber: (prior?.versionNumber ?? 0) + 1,
            title: after.title,
            description: after.description,
            parentObjectiveId: after.parentObjectiveId,
            teamId: after.teamId,
            status: after.status,
            editedByUserId,
            editReason: editReason ?? null,
          });
        }
        return after;
      });
    },

    async softDeleteObjective(objectiveId: string) {
      const [row] = await db
        .update(objectives)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.id, objectiveId),
          ),
        )
        .returning();
      return row ?? null;
    },

    async listObjectiveVersions(objectiveId: string) {
      const obj = await this.getObjectiveById(objectiveId);
      if (!obj) return [];
      return db
        .select()
        .from(objectiveVersions)
        .where(eq(objectiveVersions.objectiveId, objectiveId))
        .orderBy(desc(objectiveVersions.versionNumber));
    },

    // --- Key Results ---
    async listKeyResultsByObjective(objectiveId: string) {
      const obj = await this.getObjectiveById(objectiveId);
      if (!obj) return [];
      return db
        .select()
        .from(keyResults)
        .where(
          and(
            eq(keyResults.objectiveId, objectiveId),
            isNull(keyResults.deletedAt),
          ),
        )
        .orderBy(asc(keyResults.sortOrder), asc(keyResults.createdAt));
    },

    async getKeyResultById(keyResultId: string) {
      const [row] = await db
        .select({
          kr: keyResults,
          obj: objectives,
        })
        .from(keyResults)
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .where(
          and(
            eq(keyResults.id, keyResultId),
            isNull(keyResults.deletedAt),
            eq(objectives.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!row) return null;
      return { ...row.kr, objective: row.obj };
    },

    async createKeyResult(
      input: NewKeyResult,
      editedByUserId: string,
    ) {
      const obj = await this.getObjectiveById(input.objectiveId);
      if (!obj) return null;
      return db.transaction(async (tx) => {
        const [row] = await tx.insert(keyResults).values(input).returning();
        await tx.insert(keyResultVersions).values({
          keyResultId: row.id,
          versionNumber: 1,
          title: row.title,
          krType: row.krType,
          startValue: row.startValue,
          targetValue: row.targetValue,
          unit: row.unit,
          editedByUserId,
        });
        return row;
      });
    },

    async updateKeyResult(
      keyResultId: string,
      patch: Partial<NewKeyResult>,
      editedByUserId: string,
      editReason?: string,
    ) {
      return db.transaction(async (tx) => {
        const [before] = await tx
          .select({ kr: keyResults, obj: objectives })
          .from(keyResults)
          .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
          .where(
            and(
              eq(keyResults.id, keyResultId),
              isNull(keyResults.deletedAt),
              eq(objectives.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (!before) return null;
        const [after] = await tx
          .update(keyResults)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(keyResults.id, before.kr.id))
          .returning();
        if (needsKrVersion(before.kr as KeyResult, patch as Partial<KeyResult>)) {
          const [prior] = await tx
            .select({ versionNumber: keyResultVersions.versionNumber })
            .from(keyResultVersions)
            .where(eq(keyResultVersions.keyResultId, before.kr.id))
            .orderBy(desc(keyResultVersions.versionNumber))
            .limit(1);
          await tx.insert(keyResultVersions).values({
            keyResultId: before.kr.id,
            versionNumber: (prior?.versionNumber ?? 0) + 1,
            title: after.title,
            krType: after.krType,
            startValue: after.startValue,
            targetValue: after.targetValue,
            unit: after.unit,
            editedByUserId,
            editReason: editReason ?? null,
          });
        }
        return after;
      });
    },

    async softDeleteKeyResult(keyResultId: string) {
      const existing = await this.getKeyResultById(keyResultId);
      if (!existing) return null;
      const [row] = await db
        .update(keyResults)
        .set({ deletedAt: new Date() })
        .where(eq(keyResults.id, keyResultId))
        .returning();
      return row ?? null;
    },

    async listKeyResultVersions(keyResultId: string) {
      const kr = await this.getKeyResultById(keyResultId);
      if (!kr) return [];
      return db
        .select()
        .from(keyResultVersions)
        .where(eq(keyResultVersions.keyResultId, keyResultId))
        .orderBy(desc(keyResultVersions.versionNumber));
    },

    /**
     * Recomputes and persists `objectives.progress` as the average of its
     * non-deleted KR progresses (or its child objectives when leaf has no KRs).
     * Call after any KR update/insert/delete, or after an objective parent
     * relationship changes.
     */
    async recomputeObjectiveProgress(objectiveId: string) {
      const obj = await this.getObjectiveById(objectiveId);
      if (!obj) return null;
      const krs = await this.listKeyResultsByObjective(objectiveId);
      let progress: number;
      if (krs.length > 0) {
        progress = objectiveProgress(
          krs.map((k) => ({
            krType: k.krType,
            startValue: k.startValue,
            targetValue: k.targetValue,
            currentValue: k.currentValue,
          })),
        );
      } else {
        const children = await db
          .select({ progress: objectives.progress })
          .from(objectives)
          .where(
            and(
              eq(objectives.organizationId, organizationId),
              eq(objectives.parentObjectiveId, objectiveId),
              isNull(objectives.deletedAt),
            ),
          );
        progress = objectiveProgress([], children);
      }
      const [updated] = await db
        .update(objectives)
        .set({ progress: progress.toFixed(2), updatedAt: new Date() })
        .where(eq(objectives.id, objectiveId))
        .returning();
      if (updated?.parentObjectiveId) {
        await this.recomputeObjectiveProgress(updated.parentObjectiveId);
      }
      return updated ?? null;
    },
  };
}

export type ScopedDb = ReturnType<typeof scopedDb>;
