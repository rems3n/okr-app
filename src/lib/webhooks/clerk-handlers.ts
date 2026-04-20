import type {
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizations, users, type User } from "@/lib/db/schema";

function mapClerkRole(clerkRole: string | null | undefined): User["role"] {
  if (!clerkRole) return "member";
  if (clerkRole === "org:admin") return "admin";
  if (clerkRole === "org:owner") return "owner";
  return "member";
}

function primaryEmail(data: UserJSON): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? "";
}

function displayName(data: UserJSON): string {
  const full = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || data.username || primaryEmail(data) || "Unknown";
}

async function upsertOrganization(data: OrganizationJSON): Promise<string> {
  // New orgs land on the Free plan with a 14-day Starter trial window.
  // effectivePlan() treats trialing orgs as Starter for limit checks.
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  const [row] = await db
    .insert(organizations)
    .values({
      clerkOrgId: data.id,
      name: data.name,
      slug: data.slug ?? data.id,
      trialEndsAt,
    })
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: {
        name: data.name,
        slug: data.slug ?? data.id,
        updatedAt: new Date(),
      },
    })
    .returning({ id: organizations.id });
  return row.id;
}

async function deleteOrganizationByClerkId(clerkOrgId: string) {
  await db
    .delete(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId));
}

async function updateUserByClerkId(data: UserJSON) {
  await db
    .update(users)
    .set({
      email: primaryEmail(data),
      name: displayName(data),
      avatarUrl: data.image_url,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, data.id));
}

async function deleteUserByClerkId(clerkUserId: string) {
  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
}

async function upsertMembership(data: OrganizationMembershipJSON) {
  const orgId = await upsertOrganization(data.organization);
  const role = mapClerkRole(data.role);
  const userData = data.public_user_data;
  const email = userData?.identifier ?? "";
  const name =
    [userData?.first_name, userData?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email ||
    "Unknown";
  const clerkUserId = userData?.user_id;
  if (!clerkUserId) return;

  await db
    .insert(users)
    .values({
      clerkUserId,
      organizationId: orgId,
      email,
      name,
      avatarUrl: userData?.image_url,
      role,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        organizationId: orgId,
        email,
        name,
        avatarUrl: userData?.image_url,
        role,
        updatedAt: new Date(),
      },
    });
}

async function removeMembership(data: OrganizationMembershipJSON) {
  const clerkUserId = data.public_user_data?.user_id;
  if (!clerkUserId) return;
  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
}

/**
 * Routes each Clerk webhook event to its idempotent handler. Every handler
 * uses upsert/delete by the Clerk ID so re-delivery is safe.
 */
export async function handleClerkEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case "organization.created":
    case "organization.updated":
      await upsertOrganization(event.data);
      return;
    case "organization.deleted":
      if (event.data.id) await deleteOrganizationByClerkId(event.data.id);
      return;
    case "organizationMembership.created":
    case "organizationMembership.updated":
      await upsertMembership(event.data);
      return;
    case "organizationMembership.deleted":
      await removeMembership(event.data);
      return;
    case "user.updated":
      await updateUserByClerkId(event.data);
      return;
    case "user.deleted":
      if (event.data.id) await deleteUserByClerkId(event.data.id);
      return;
    case "user.created":
      // Users are persisted when they gain an org membership, which fires
      // organizationMembership.created. A bare user.created carries no org
      // context and our schema requires organization_id.
      return;
    default:
      return;
  }
}
