import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { CycleBoardView } from "@/components/board/cycle-board-view";
import { db } from "@/lib/db";
import { cycleShareTokens } from "@/lib/db/schema";
import { loadCycleBoard } from "@/lib/cycle-board";

type Params = Promise<{ token: string }>;

/**
 * Unauthenticated read-only board view. Token is a base64url string; we
 * SHA-256 it to look up the row and then 404 if expired or revoked.
 */
export default async function PublicCycleBoard({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const [row] = await db
    .select()
    .from(cycleShareTokens)
    .where(
      and(
        eq(cycleShareTokens.tokenHash, tokenHash),
        gt(cycleShareTokens.expiresAt, now),
        isNull(cycleShareTokens.revokedAt),
      ),
    )
    .limit(1);
  if (!row) notFound();

  const data = await loadCycleBoard(row.organizationId, row.cycleId);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <CycleBoardView data={data} />
    </main>
  );
}
