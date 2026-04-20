import { describe, expect, it } from "vitest";

import { can } from "@/lib/auth/permissions";

describe("can()", () => {
  it("owner can manage org and billing", () => {
    expect(can("owner", "org.manage")).toBe(true);
    expect(can("owner", "org.billing")).toBe(true);
  });

  it("admin can manage org but not billing", () => {
    expect(can("admin", "org.manage")).toBe(true);
    expect(can("admin", "org.billing")).toBe(false);
  });

  it("members cannot invite or delete teams", () => {
    expect(can("member", "member.invite")).toBe(false);
    expect(can("member", "team.delete")).toBe(false);
    expect(can("member", "team.manage")).toBe(false);
  });

  it("members can edit their own profile", () => {
    expect(can("member", "profile.editOwn")).toBe(true);
    expect(can("admin", "profile.editOwn")).toBe(true);
    expect(can("owner", "profile.editOwn")).toBe(true);
  });

  it("admin can assign managers but only owner handles billing", () => {
    expect(can("admin", "manager.assign")).toBe(true);
    expect(can("member", "manager.assign")).toBe(false);
    expect(can("admin", "org.billing")).toBe(false);
  });
});
