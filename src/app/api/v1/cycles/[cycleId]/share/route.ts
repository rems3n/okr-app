import crypto from "node:crypto";

import { withAuth } from "@/lib/api/with-auth";
import { db } from "@/lib/db";
import { cycleShareTokens } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";

const PUBLIC_APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://okr-app-production-46c5.up.railway.app";

const DEFAULT_TTL_DAYS = 30;

/**
 * Generates a one-shot URL-safe token for the cycle. We store only the
 * SHA-256 of the token; the plaintext is returned to the caller and must be
 * preserved (admin can re-issue but cannot recover an existing one).
 */
export const POST = withAuth<undefined, { cycleId: string }>({
  require: "org.manage",
  handler: async ({ ctx, db: scoped, params }) => {
    const cycle = await scoped.getCycleById(params.cycleId);
    if (!cycle) throw new NotFoundError("Cycle not found");

    const tokenBytes = crypto.randomBytes(24);
    const token = tokenBytes.toString("base64url");
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_TTL_DAYS);

    await db.insert(cycleShareTokens).values({
      organizationId: ctx.orgId,
      cycleId: cycle.id,
      tokenHash,
      expiresAt,
      createdByUserId: ctx.userId,
    });

    return {
      token,
      url: `${PUBLIC_APP_URL()}/public/cycle/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  },
});
