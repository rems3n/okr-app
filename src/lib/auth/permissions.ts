import type { User } from "@/lib/db/schema";

export type Role = User["role"];

export type Action =
  | "org.manage"
  | "org.billing"
  | "team.create"
  | "team.manage"
  | "team.delete"
  | "member.invite"
  | "member.remove"
  | "member.changeRole"
  | "manager.assign"
  | "profile.editOwn"
  | "integrations.connect";

const OWNER: Role[] = ["owner"];
const ADMIN: Role[] = ["owner", "admin"];
const MEMBER: Role[] = ["owner", "admin", "member"];

const MATRIX: Record<Action, Role[]> = {
  "org.manage": ADMIN,
  "org.billing": OWNER,
  "team.create": ADMIN,
  "team.manage": ADMIN,
  "team.delete": ADMIN,
  "member.invite": ADMIN,
  "member.remove": ADMIN,
  "member.changeRole": ADMIN,
  "manager.assign": ADMIN,
  "profile.editOwn": MEMBER,
  "integrations.connect": ADMIN,
};

/**
 * Returns whether a user with `role` is permitted to perform `action`.
 * Sprint 1 surface only — team-lead-scoped permissions land in Sprint 2 when
 * team-level objective editing ships.
 */
export function can(role: Role, action: Action): boolean {
  return MATRIX[action].includes(role);
}
