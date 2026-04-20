import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";
import { AppError, UnauthorizedError, toResponse } from "@/lib/errors";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("errors", () => {
  it("UnauthorizedError is a 401 AppError", () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("toResponse formats AppError as JSON", async () => {
    const res = toResponse(new UnauthorizedError("nope"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "UNAUTHORIZED", message: "nope" } });
  });
});
