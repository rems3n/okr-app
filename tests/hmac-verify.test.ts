import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyHmacSha256 } from "@/lib/webhooks/verify-hmac";

function sign(secret: string, body: string, prefixed = true): string {
  const payload = prefixed ? `${secret}${body}` : body;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyHmacSha256", () => {
  const secret = "whsec_test_1234";
  const body = JSON.stringify({ connectionId: "org_linear", records: [] });

  it("accepts a valid secret-prefixed signature", () => {
    const sig = sign(secret, body, true);
    expect(
      verifyHmacSha256({
        secret,
        rawBody: body,
        signature: sig,
        style: "secret-prefixed",
      }),
    ).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(
      verifyHmacSha256({
        secret,
        rawBody: body,
        signature: "deadbeef",
        style: "secret-prefixed",
      }),
    ).toBe(false);
  });

  it("rejects when signature is missing", () => {
    expect(
      verifyHmacSha256({
        secret,
        rawBody: body,
        signature: null,
      }),
    ).toBe(false);
  });

  it("supports the pure-body HMAC convention", () => {
    const sig = sign(secret, body, false);
    expect(
      verifyHmacSha256({
        secret,
        rawBody: body,
        signature: sig,
        style: "pure",
      }),
    ).toBe(true);
  });

  it("strips a leading sha256= prefix", () => {
    const sig = sign(secret, body, true);
    expect(
      verifyHmacSha256({
        secret,
        rawBody: body,
        signature: `sha256=${sig}`,
        style: "secret-prefixed",
      }),
    ).toBe(true);
  });
});
