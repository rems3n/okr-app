import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db as defaultDb } from "./index";
import {
  checkIns,
  comments,
  cycles,
  entityTags,
  integrationsConnected,
  keyResultScores,
  keyResultVersions,
  keyResults,
  managerAssignments,
  metricBindings,
  metricDefinitions,
  metricValues,
  objectiveVersions,
  objectives,
  organizations,
  tags,
  teamMemberships,
  teams,
  users,
  type KeyResult,
  type NewCheckIn,
  type NewComment,
  type NewCycle,
  type NewIntegrationConnected,
  type NewKeyResult,
  type NewObjective,
  type NewTag,
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

    // --- Check-ins ---
    async createCheckIn(input: {
      keyResultId: string;
      authorUserId: string;
      newValue: number;
      confidence: "on_track" | "at_risk" | "off_track";
      note?: string | null;
      source?: "manual" | "sync";
    }) {
      const kr = await this.getKeyResultById(input.keyResultId);
      if (!kr) return null;
      const previousValue = kr.currentValue;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(checkIns)
          .values({
            keyResultId: input.keyResultId,
            authorUserId: input.authorUserId,
            previousValue,
            newValue: input.newValue.toString(),
            confidence: input.confidence,
            note: input.note ?? null,
            source: input.source ?? "manual",
          } satisfies NewCheckIn)
          .returning();
        await tx
          .update(keyResults)
          .set({
            currentValue: input.newValue.toString(),
            updatedAt: new Date(),
          })
          .where(eq(keyResults.id, input.keyResultId));
        return row;
      });
    },

    async listCheckInsByKr(keyResultId: string, limit = 50) {
      const kr = await this.getKeyResultById(keyResultId);
      if (!kr) return [];
      return db
        .select()
        .from(checkIns)
        .where(eq(checkIns.keyResultId, keyResultId))
        .orderBy(desc(checkIns.createdAt))
        .limit(limit);
    },

    async listCheckInsByObjective(objectiveId: string, limit = 50) {
      const obj = await this.getObjectiveById(objectiveId);
      if (!obj) return [];
      const krIds = (await this.listKeyResultsByObjective(objectiveId)).map(
        (k) => k.id,
      );
      if (krIds.length === 0) return [];
      return db
        .select({
          id: checkIns.id,
          keyResultId: checkIns.keyResultId,
          authorUserId: checkIns.authorUserId,
          previousValue: checkIns.previousValue,
          newValue: checkIns.newValue,
          confidence: checkIns.confidence,
          note: checkIns.note,
          source: checkIns.source,
          createdAt: checkIns.createdAt,
          keyResultTitle: keyResults.title,
          authorName: users.name,
        })
        .from(checkIns)
        .innerJoin(keyResults, eq(keyResults.id, checkIns.keyResultId))
        .innerJoin(users, eq(users.id, checkIns.authorUserId))
        .where(inArray(checkIns.keyResultId, krIds))
        .orderBy(desc(checkIns.createdAt))
        .limit(limit);
    },

    /**
     * Latest check-in per KR for a given list of KR ids. Used by the UI to
     * render the confidence dot and "days since last update".
     */
    async latestCheckInsFor(keyResultIds: string[]) {
      if (keyResultIds.length === 0) return [] as Array<{
        keyResultId: string;
        confidence: "on_track" | "at_risk" | "off_track";
        createdAt: Date;
      }>;
      // Correlated subquery would be nicer; for this scale a grouped fetch
      // and JS reduction is fine.
      const rows = await db
        .select({
          keyResultId: checkIns.keyResultId,
          confidence: checkIns.confidence,
          createdAt: checkIns.createdAt,
        })
        .from(checkIns)
        .where(inArray(checkIns.keyResultId, keyResultIds))
        .orderBy(desc(checkIns.createdAt));
      const latest = new Map<
        string,
        { keyResultId: string; confidence: "on_track" | "at_risk" | "off_track"; createdAt: Date }
      >();
      for (const r of rows) {
        if (!latest.has(r.keyResultId)) latest.set(r.keyResultId, r);
      }
      return Array.from(latest.values());
    },

    /**
     * KRs owned by `userId` that need a check-in — either never been checked
     * in or stale beyond `staleAfterDays`. Used by the check-in flow and the
     * dashboard's Needs Attention section.
     */
    /**
     * Every non-deleted KR in the cycle, joined with its objective + owner
     * name. Used by the admin dashboard to compute confidence buckets and
     * render the at-risk list without N+1.
     */
    async listKrsForCycle(cycleId: string) {
      return db
        .select({
          kr: keyResults,
          obj: objectives,
          ownerName: users.name,
        })
        .from(keyResults)
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .innerJoin(users, eq(users.id, keyResults.ownerUserId))
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.cycleId, cycleId),
            isNull(keyResults.deletedAt),
            isNull(objectives.deletedAt),
          ),
        );
    },

    async listKrsNeedingCheckIn(
      userId: string,
      cycleId: string,
      staleAfterDays = 7,
    ) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - staleAfterDays);
      const rows = await db
        .select({
          kr: keyResults,
          obj: objectives,
        })
        .from(keyResults)
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.cycleId, cycleId),
            eq(keyResults.ownerUserId, userId),
            isNull(keyResults.deletedAt),
            isNull(objectives.deletedAt),
          ),
        );
      if (rows.length === 0) return [];
      const krIds = rows.map((r) => r.kr.id);
      const latest = await this.latestCheckInsFor(krIds);
      const latestById = new Map(latest.map((l) => [l.keyResultId, l]));
      return rows
        .filter((r) => {
          const last = latestById.get(r.kr.id);
          if (!last) return true;
          return last.createdAt < threshold;
        })
        .map((r) => ({
          ...r.kr,
          objective: r.obj,
          lastCheckInAt: latestById.get(r.kr.id)?.createdAt ?? null,
        }));
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

    // --- Integrations ---
    async listConnectedIntegrations() {
      return db
        .select()
        .from(integrationsConnected)
        .where(eq(integrationsConnected.organizationId, organizationId));
    },

    async getIntegrationByProvider(provider: string) {
      const [row] = await db
        .select()
        .from(integrationsConnected)
        .where(
          and(
            eq(integrationsConnected.organizationId, organizationId),
            eq(integrationsConnected.provider, provider),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async getIntegrationById(id: string) {
      const [row] = await db
        .select()
        .from(integrationsConnected)
        .where(
          and(
            eq(integrationsConnected.organizationId, organizationId),
            eq(integrationsConnected.id, id),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async upsertIntegration(
      input: Omit<NewIntegrationConnected, "organizationId">,
    ) {
      const [row] = await db
        .insert(integrationsConnected)
        .values({ ...input, organizationId })
        .onConflictDoUpdate({
          target: [
            integrationsConnected.organizationId,
            integrationsConnected.provider,
          ],
          set: {
            nangoConnectionId: input.nangoConnectionId,
            status: input.status ?? "active",
            connectedByUserId: input.connectedByUserId,
            errorMessage: null,
          },
        })
        .returning();
      return row;
    },

    async updateIntegrationStatus(
      id: string,
      patch: {
        status?: "active" | "error" | "disconnected";
        errorMessage?: string | null;
        lastSyncedAt?: Date | null;
      },
    ) {
      const [row] = await db
        .update(integrationsConnected)
        .set(patch)
        .where(
          and(
            eq(integrationsConnected.organizationId, organizationId),
            eq(integrationsConnected.id, id),
          ),
        )
        .returning();
      return row ?? null;
    },

    async disconnectIntegration(id: string) {
      const [row] = await db
        .update(integrationsConnected)
        .set({ status: "disconnected" })
        .where(
          and(
            eq(integrationsConnected.organizationId, organizationId),
            eq(integrationsConnected.id, id),
          ),
        )
        .returning();
      return row ?? null;
    },

    // --- Metric bindings ---
    async getBindingForKr(keyResultId: string) {
      const kr = await this.getKeyResultById(keyResultId);
      if (!kr) return null;
      const [row] = await db
        .select({
          binding: metricBindings,
          definition: metricDefinitions,
          integration: integrationsConnected,
        })
        .from(metricBindings)
        .innerJoin(
          metricDefinitions,
          eq(metricDefinitions.id, metricBindings.metricDefinitionId),
        )
        .innerJoin(
          integrationsConnected,
          eq(integrationsConnected.id, metricBindings.integrationConnectedId),
        )
        .where(eq(metricBindings.keyResultId, keyResultId))
        .limit(1);
      return row ?? null;
    },

    async listBindingsForIntegration(integrationConnectedId: string) {
      return db
        .select({
          binding: metricBindings,
          definition: metricDefinitions,
        })
        .from(metricBindings)
        .innerJoin(
          metricDefinitions,
          eq(metricDefinitions.id, metricBindings.metricDefinitionId),
        )
        .innerJoin(
          integrationsConnected,
          eq(integrationsConnected.id, metricBindings.integrationConnectedId),
        )
        .where(
          and(
            eq(integrationsConnected.organizationId, organizationId),
            eq(metricBindings.integrationConnectedId, integrationConnectedId),
          ),
        );
    },

    async createMetricBinding(input: {
      keyResultId: string;
      integrationConnectedId: string;
      metricDefinitionId: string;
      config: Record<string, unknown>;
      createdByUserId: string;
    }) {
      // Ensure KR and integration both belong to this org.
      const kr = await this.getKeyResultById(input.keyResultId);
      const integration = await this.getIntegrationById(
        input.integrationConnectedId,
      );
      if (!kr || !integration) return null;
      const [row] = await db
        .insert(metricBindings)
        .values(input)
        .returning();
      return row;
    },

    async deleteMetricBinding(id: string) {
      await db.delete(metricBindings).where(eq(metricBindings.id, id));
    },

    /**
     * Persist a new metric value AND emit a sync-sourced check-in that
     * carries the previous confidence forward. Recomputes objective progress.
     * Called by the Inngest processor for each bound KR after a Nango sync.
     */
    async appendMetricValue(input: {
      keyResultId: string;
      value: number;
      capturedAt?: Date;
      authorUserId: string;
    }) {
      const kr = await this.getKeyResultById(input.keyResultId);
      if (!kr) return null;
      const previous = kr.currentValue;

      // Pick up the last check-in's confidence (default on_track).
      const lastCheckIns = await this.latestCheckInsFor([input.keyResultId]);
      const carriedConfidence =
        lastCheckIns[0]?.confidence ?? "on_track";

      await db.transaction(async (tx) => {
        await tx.insert(metricValues).values({
          keyResultId: input.keyResultId,
          value: input.value.toString(),
          capturedAt: input.capturedAt ?? new Date(),
        });
        await tx.insert(checkIns).values({
          keyResultId: input.keyResultId,
          authorUserId: input.authorUserId,
          previousValue: previous,
          newValue: input.value.toString(),
          confidence: carriedConfidence,
          note: null,
          source: "sync",
        } satisfies NewCheckIn);
        await tx
          .update(keyResults)
          .set({
            currentValue: input.value.toString(),
            updatedAt: new Date(),
          })
          .where(eq(keyResults.id, input.keyResultId));
      });
      await this.recomputeObjectiveProgress(kr.objectiveId);
      return { previous, next: input.value };
    },

    async listMetricValues(keyResultId: string, limit = 100) {
      const kr = await this.getKeyResultById(keyResultId);
      if (!kr) return [];
      return db
        .select()
        .from(metricValues)
        .where(eq(metricValues.keyResultId, keyResultId))
        .orderBy(desc(metricValues.capturedAt))
        .limit(limit);
    },

    // --- Comments ---
    async listComments(
      entityType: "objective" | "key_result" | "check_in",
      entityId: string,
    ) {
      return db
        .select({
          id: comments.id,
          entityType: comments.entityType,
          entityId: comments.entityId,
          authorUserId: comments.authorUserId,
          body: comments.body,
          mentionedUserIds: comments.mentionedUserIds,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          authorName: users.name,
          authorAvatarUrl: users.avatarUrl,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorUserId))
        .where(
          and(
            eq(comments.organizationId, organizationId),
            eq(comments.entityType, entityType),
            eq(comments.entityId, entityId),
          ),
        )
        .orderBy(asc(comments.createdAt));
    },

    async createComment(
      input: Omit<NewComment, "organizationId">,
    ) {
      const [row] = await db
        .insert(comments)
        .values({ ...input, organizationId })
        .returning();
      return row;
    },

    async updateComment(
      commentId: string,
      authorUserId: string,
      body: string,
      mentionedUserIds: string[],
    ) {
      const [row] = await db
        .update(comments)
        .set({
          body,
          mentionedUserIds,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(comments.organizationId, organizationId),
            eq(comments.id, commentId),
            eq(comments.authorUserId, authorUserId),
          ),
        )
        .returning();
      return row ?? null;
    },

    async deleteComment(commentId: string, authorUserId: string) {
      const [row] = await db
        .delete(comments)
        .where(
          and(
            eq(comments.organizationId, organizationId),
            eq(comments.id, commentId),
            eq(comments.authorUserId, authorUserId),
          ),
        )
        .returning();
      return row ?? null;
    },

    // --- Tags ---
    async listTags() {
      return db
        .select()
        .from(tags)
        .where(eq(tags.organizationId, organizationId))
        .orderBy(asc(tags.name));
    },

    async createTag(input: Omit<NewTag, "organizationId">) {
      const [row] = await db
        .insert(tags)
        .values({ ...input, organizationId })
        .returning();
      return row;
    },

    async deleteTag(tagId: string) {
      await db
        .delete(tags)
        .where(
          and(eq(tags.organizationId, organizationId), eq(tags.id, tagId)),
        );
    },

    async listTagsForEntity(
      entityType: "objective" | "key_result",
      entityId: string,
    ) {
      return db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(entityTags)
        .innerJoin(tags, eq(tags.id, entityTags.tagId))
        .where(
          and(
            eq(tags.organizationId, organizationId),
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, entityId),
          ),
        );
    },

    async applyTag(
      tagId: string,
      entityType: "objective" | "key_result",
      entityId: string,
    ) {
      // Confirm tag belongs to this org.
      const [tag] = await db
        .select()
        .from(tags)
        .where(
          and(eq(tags.organizationId, organizationId), eq(tags.id, tagId)),
        )
        .limit(1);
      if (!tag) return null;
      const [row] = await db
        .insert(entityTags)
        .values({ tagId, entityType, entityId })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    },

    async removeTag(
      tagId: string,
      entityType: "objective" | "key_result",
      entityId: string,
    ) {
      await db
        .delete(entityTags)
        .where(
          and(
            eq(entityTags.tagId, tagId),
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, entityId),
          ),
        );
    },

    /**
     * Bulk fetch of tag lists keyed by entity id — used by the tree/list view
     * to render tag chips without a per-row round trip.
     */
    async listTagsForEntities(
      entityType: "objective" | "key_result",
      entityIds: string[],
    ) {
      if (entityIds.length === 0)
        return {} as Record<string, { id: string; name: string; color: string }[]>;
      const rows = await db
        .select({
          entityId: entityTags.entityId,
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(entityTags)
        .innerJoin(tags, eq(tags.id, entityTags.tagId))
        .where(
          and(
            eq(tags.organizationId, organizationId),
            eq(entityTags.entityType, entityType),
            inArray(entityTags.entityId, entityIds),
          ),
        );
      const out: Record<
        string,
        { id: string; name: string; color: string }[]
      > = {};
      for (const r of rows) {
        if (!out[r.entityId]) out[r.entityId] = [];
        out[r.entityId].push({ id: r.id, name: r.name, color: r.color });
      }
      return out;
    },

    // --- Scoring (end-of-cycle) ---
    async upsertScore(input: {
      keyResultId: string;
      score: number;
      finalValue: number;
      reflection: string;
      scoredByUserId: string;
    }) {
      // Cross-org safety: confirm the KR is reachable from this org.
      const kr = await this.getKeyResultById(input.keyResultId);
      if (!kr) return null;
      const [row] = await db
        .insert(keyResultScores)
        .values({
          keyResultId: input.keyResultId,
          score: input.score.toFixed(2),
          finalValue: input.finalValue.toString(),
          reflection: input.reflection,
          scoredByUserId: input.scoredByUserId,
        })
        .onConflictDoUpdate({
          target: keyResultScores.keyResultId,
          set: {
            score: input.score.toFixed(2),
            finalValue: input.finalValue.toString(),
            reflection: input.reflection,
            scoredByUserId: input.scoredByUserId,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    },

    async getScoreForKr(keyResultId: string) {
      const kr = await this.getKeyResultById(keyResultId);
      if (!kr) return null;
      const [row] = await db
        .select()
        .from(keyResultScores)
        .where(eq(keyResultScores.keyResultId, keyResultId))
        .limit(1);
      return row ?? null;
    },

    async listScoresForCycle(cycleId: string) {
      const cycle = await this.getCycleById(cycleId);
      if (!cycle) return [];
      const rows = await db
        .select({
          score: keyResultScores,
          krTitle: keyResults.title,
          objectiveId: objectives.id,
          objectiveTitle: objectives.title,
        })
        .from(keyResultScores)
        .innerJoin(
          keyResults,
          eq(keyResults.id, keyResultScores.keyResultId),
        )
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.cycleId, cycleId),
          ),
        );
      return rows;
    },

    /**
     * Coverage snapshot used for cycle-close gating. Returns the set of KR ids
     * in the cycle and which of them already have a score row.
     */
    async scoreCoverageForCycle(cycleId: string) {
      const cycle = await this.getCycleById(cycleId);
      if (!cycle)
        return { total: 0, scored: 0, unscoredKrIds: [] as string[] };
      const krs = await db
        .select({ id: keyResults.id })
        .from(keyResults)
        .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
        .where(
          and(
            eq(objectives.organizationId, organizationId),
            eq(objectives.cycleId, cycleId),
            isNull(keyResults.deletedAt),
            isNull(objectives.deletedAt),
          ),
        );
      if (krs.length === 0)
        return { total: 0, scored: 0, unscoredKrIds: [] };
      const scoredRows =
        krs.length === 0
          ? []
          : await db
              .select({ keyResultId: keyResultScores.keyResultId })
              .from(keyResultScores)
              .where(
                inArray(
                  keyResultScores.keyResultId,
                  krs.map((k) => k.id),
                ),
              );
      const scored = new Set(scoredRows.map((r) => r.keyResultId));
      return {
        total: krs.length,
        scored: scored.size,
        unscoredKrIds: krs.map((k) => k.id).filter((id) => !scored.has(id)),
      };
    },
  };
}

export type ScopedDb = ReturnType<typeof scopedDb>;
