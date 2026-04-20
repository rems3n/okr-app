import { cache } from "react";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  users,
  type Organization,
  type User,
} from "@/lib/db/schema";
import { NoActiveOrgError, UnauthorizedError } from "@/lib/errors";

export type AuthContext = {
  userId: string;
  orgId: string;
  role: User["role"];
  clerkUserId: string;
  clerkOrgId: string;
  email: string;
  name: string;
};

function mapClerkRole(clerkRole: string | null | undefined): User["role"] {
  if (!clerkRole) return "member";
  if (clerkRole === "org:admin") return "admin";
  if (clerkRole === "org:owner") return "owner";
  return "member";
}

async function ensureOrganization(clerkOrgId: string): Promise<Organization> {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (existing) return existing;

  const client = await clerkClient();
  const clerkOrg = await client.organizations.getOrganization({
    organizationId: clerkOrgId,
  });

  const [created] = await db
    .insert(organizations)
    .values({
      clerkOrgId: clerkOrg.id,
      name: clerkOrg.name,
      slug: clerkOrg.slug ?? clerkOrg.id,
    })
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: {
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? clerkOrg.id,
        updatedAt: new Date(),
      },
    })
    .returning();
  return created;
}

async function ensureUser(
  clerkUserId: string,
  organizationId: string,
  role: User["role"],
): Promise<User> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new UnauthorizedError();

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    primaryEmail ||
    "Unknown";

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId,
      organizationId,
      email: primaryEmail,
      name,
      avatarUrl: clerkUser.imageUrl,
      role,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        organizationId,
        email: primaryEmail,
        name,
        avatarUrl: clerkUser.imageUrl,
        role,
        updatedAt: new Date(),
      },
    })
    .returning();
  return created;
}

/**
 * Resolves the current request's Clerk session into an AuthContext backed by
 * Postgres rows. Lazy-creates the org and user if the Clerk webhook hasn't
 * landed yet, which avoids 500s during the first-signup race.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  if (!session.orgId) throw new NoActiveOrgError();

  const org = await ensureOrganization(session.orgId);
  const role = mapClerkRole(session.orgRole);
  const user = await ensureUser(session.userId, org.id, role);

  Sentry.setUser({ id: user.id, email: user.email });
  Sentry.setTag("organization_id", org.id);

  return {
    userId: user.id,
    orgId: org.id,
    role: user.role,
    clerkUserId: session.userId,
    clerkOrgId: session.orgId,
    email: user.email,
    name: user.name,
  };
});
