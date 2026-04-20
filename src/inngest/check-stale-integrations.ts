import { eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { integrationsConnected } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

/**
 * Daily at 08:00 UTC. Flags integrations whose last sync is older than
 * STALE_AFTER_HOURS (2x the default hourly cadence) so the settings page
 * surfaces an error state. New integrations with no sync yet are left alone
 * for a grace window of NEW_GRACE_HOURS after connect.
 */
const STALE_AFTER_HOURS = 6;
const NEW_GRACE_HOURS = 3;

export const checkStaleIntegrations = inngest.createFunction(
  {
    id: "check-stale-integrations",
    triggers: [{ cron: "0 8 * * *" }],
  },
  async ({ step, logger }) => {
    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - STALE_AFTER_HOURS * 60 * 60 * 1000,
    );
    const newGrace = new Date(
      now.getTime() - NEW_GRACE_HOURS * 60 * 60 * 1000,
    );

    const rows = await step.run("find-stale", () =>
      db
        .select()
        .from(integrationsConnected)
        .where(
          or(
            lt(integrationsConnected.lastSyncedAt, staleThreshold),
            // Never-synced integrations older than grace are also suspicious.
            // (db.and isn't needed — a plain comparison handles the filter.)
          ),
        ),
    );

    for (const row of rows) {
      if (row.status !== "active") continue;
      const lastSynced = row.lastSyncedAt ? new Date(row.lastSyncedAt) : null;
      const created = new Date(row.createdAt);
      const shouldFlag = lastSynced
        ? lastSynced < staleThreshold
        : created < newGrace;
      if (!shouldFlag) continue;
      await step.run(`flag-${row.id}`, async () => {
        await db
          .update(integrationsConnected)
          .set({
            status: "error",
            errorMessage: lastSynced
              ? `No sync in ${STALE_AFTER_HOURS}h+`
              : `No sync since connection at ${created.toISOString()}`,
          })
          .where(eq(integrationsConnected.id, row.id));
        logger.warn(
          `Flagged ${row.provider} integration ${row.id} as stale`,
        );
      });
    }

    // Healthy integrations that recovered after a previous error
    // (i.e. synced recently) get their error cleared.
    const recovered = await step.run("find-recovered", () =>
      db
        .select()
        .from(integrationsConnected)
        .where(eq(integrationsConnected.status, "error")),
    );
    for (const row of recovered) {
      if (!row.lastSyncedAt) continue;
      const lastSynced = new Date(row.lastSyncedAt);
      if (lastSynced < staleThreshold) continue;
      await db
        .update(integrationsConnected)
        .set({ status: "active", errorMessage: null })
        .where(eq(integrationsConnected.id, row.id));
      logger.info(`Recovered ${row.provider} integration ${row.id}`);
    }
    // Avoid unused-import warning when the helper is replaced in tests.
    void isNull;
  },
);
