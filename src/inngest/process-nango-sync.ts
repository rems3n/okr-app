import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";
import {
  integrationsConnected,
  metricBindings,
  metricDefinitions,
} from "@/lib/db/schema";
import { parseConnectionId } from "@/lib/integrations/nango";
import { inngest } from "@/lib/inngest/client";

type NangoRecord = Record<string, unknown>;

type NangoWebhookPayload = {
  connectionId?: string;
  syncName?: string;
  model?: string;
  modifiedRecords?: NangoRecord[];
  responseResults?: { added?: number; updated?: number; deleted?: number };
  // Nango sends records either in `modifiedRecords` or we fetch via API in a
  // future iteration. Sprint 5 processes whatever is inlined.
  records?: NangoRecord[];
};

/**
 * Reduces a batch of Nango sync records into a single scalar KR value.
 * Provider/metric-specific — keep this mapping in one place so the rest of
 * the codebase stays provider-agnostic.
 */
function computeValue(
  metricKey: string,
  records: NangoRecord[],
  config: Record<string, unknown>,
): number | null {
  switch (metricKey) {
    case "linear.issues_completed": {
      const teamKey = String(config.teamKey ?? "").toLowerCase();
      const label = config.labelFilter
        ? String(config.labelFilter).toLowerCase()
        : null;
      return records.filter((r) => {
        const rTeam = String(
          (r as { teamKey?: string; team?: { key?: string } }).teamKey ??
            (r as { team?: { key?: string } }).team?.key ??
            "",
        ).toLowerCase();
        if (teamKey && rTeam && rTeam !== teamKey) return false;
        if (label) {
          const labels = ((r as { labels?: string[] }).labels ?? []).map(
            (l) => String(l).toLowerCase(),
          );
          if (!labels.includes(label)) return false;
        }
        return true;
      }).length;
    }
    case "linear.cycle_progress": {
      const cycleName = String(config.cycleName ?? "");
      const match = records
        .filter((r) => {
          const name = String((r as { name?: string }).name ?? "");
          return !cycleName || name === cycleName;
        })
        .pop();
      if (!match) return null;
      const progress = (match as { progress?: number }).progress;
      return typeof progress === "number"
        ? Math.round(progress * 100) / 100
        : null;
    }
    default:
      return null;
  }
}

export const processNangoSync = inngest.createFunction(
  {
    id: "process-nango-sync",
    triggers: [{ event: "nango/sync.completed" }],
  },
  async ({ event, step, logger }) => {
    const payload = event.data as NangoWebhookPayload;
    const connectionId = payload.connectionId;
    const syncName = payload.syncName;
    if (!connectionId || !syncName) {
      logger.warn("Nango webhook missing connectionId or syncName");
      return;
    }

    const parsed = parseConnectionId(connectionId);
    if (!parsed) {
      logger.warn(`Unable to parse connectionId=${connectionId}`);
      return;
    }

    await step.run(`sync-${syncName}`, async () => {
      const [integration] = await db
        .select()
        .from(integrationsConnected)
        .where(eq(integrationsConnected.nangoConnectionId, connectionId))
        .limit(1);
      if (!integration) {
        logger.warn(`No integration row for ${connectionId}`);
        return;
      }

      // Find bindings whose metric_definition uses this Nango sync.
      const bindings = await db
        .select({
          binding: metricBindings,
          definition: metricDefinitions,
        })
        .from(metricBindings)
        .innerJoin(
          metricDefinitions,
          eq(metricDefinitions.id, metricBindings.metricDefinitionId),
        )
        .where(
          eq(metricBindings.integrationConnectedId, integration.id),
        );
      const relevant = bindings.filter(
        (b) => b.definition.nangoSyncName === syncName,
      );
      if (relevant.length === 0) {
        logger.info(`No bindings for sync=${syncName}; recording ping`);
      }

      const scoped = scopedDb(integration.organizationId);
      const records = payload.records ?? payload.modifiedRecords ?? [];

      try {
        for (const { binding, definition } of relevant) {
          const value = computeValue(
            definition.key,
            records,
            (binding.config as Record<string, unknown>) ?? {},
          );
          if (value === null) {
            logger.warn(
              `computeValue returned null for ${definition.key} — skipping KR ${binding.keyResultId}`,
            );
            continue;
          }
          await scoped.appendMetricValue({
            keyResultId: binding.keyResultId,
            value,
            authorUserId: binding.createdByUserId,
          });
        }
        await scoped.updateIntegrationStatus(integration.id, {
          status: "active",
          lastSyncedAt: new Date(),
          errorMessage: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown sync error";
        await scoped.updateIntegrationStatus(integration.id, {
          status: "error",
          errorMessage: message,
        });
        throw err;
      }
    });
  },
);
