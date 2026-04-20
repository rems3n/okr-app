import { and, desc, eq, isNull } from "drizzle-orm";

import { db as defaultDb } from "./index";
import {
  managerAssignments,
  organizations,
  teamMemberships,
  teams,
  users,
  type NewTeam,
  type NewUser,
} from "./schema";

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
  };
}

export type ScopedDb = ReturnType<typeof scopedDb>;
