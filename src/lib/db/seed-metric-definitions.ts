import { db } from "./index";
import { metricDefinitions, type NewMetricDefinition } from "./schema";

/**
 * Curated catalog of metric definitions. Nango sync names are the contract
 * between our Inngest processor and Nango's dashboard — if you rename a sync
 * in Nango, update the corresponding `nangoSyncName` here.
 *
 * Only Linear rows ship with enabled=true in Sprint 5. Sprint 6 flips flags
 * as the corresponding Nango syncs land.
 */
const DEFS: NewMetricDefinition[] = [
  {
    provider: "linear",
    key: "linear.issues_completed",
    label: "Linear: Issues completed",
    description: "Count of issues moved to a Done state.",
    configSchema: {
      type: "object",
      properties: {
        teamKey: { type: "string", title: "Team key (e.g. ENG)" },
        labelFilter: {
          type: "string",
          title: "Label filter (optional)",
        },
      },
      required: ["teamKey"],
    },
    nangoSyncName: "linear-issues-completed",
    outputUnit: "count",
    enabled: true,
  },
  {
    provider: "linear",
    key: "linear.cycle_progress",
    label: "Linear: Cycle progress",
    description: "Percent of cycle scope completed.",
    configSchema: {
      type: "object",
      properties: {
        teamKey: { type: "string", title: "Team key" },
        cycleName: { type: "string", title: "Cycle name" },
      },
      required: ["teamKey", "cycleName"],
    },
    nangoSyncName: "linear-cycle-progress",
    outputUnit: "%",
    enabled: true,
  },
  // --- Sprint 6 providers (seeded disabled) ---
  {
    provider: "slack",
    key: "slack.messages_in_channel",
    label: "Slack: Messages in channel",
    description: "Message count in a specific channel.",
    configSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", title: "Channel ID" },
      },
      required: ["channelId"],
    },
    nangoSyncName: "slack-channel-messages",
    outputUnit: "count",
    enabled: true,
  },
  {
    provider: "jira",
    key: "jira.issues_closed",
    label: "Jira: Issues closed in project",
    description: "Count of issues transitioned to Done.",
    configSchema: {
      type: "object",
      properties: {
        projectKey: { type: "string", title: "Project key" },
        issueType: {
          type: "string",
          title: "Issue type filter (optional)",
        },
      },
      required: ["projectKey"],
    },
    nangoSyncName: "jira-issues-closed",
    outputUnit: "count",
    enabled: true,
  },
  {
    provider: "quickbooks",
    key: "quickbooks.revenue",
    label: "QuickBooks: Revenue",
    description: "Sum of invoice revenue for the period.",
    configSchema: { type: "object", properties: {} },
    nangoSyncName: "quickbooks-revenue",
    outputUnit: "$",
    enabled: true,
  },
  {
    provider: "quickbooks",
    key: "quickbooks.cash_balance",
    label: "QuickBooks: Cash balance",
    description: "Current bank/cash account balance.",
    configSchema: { type: "object", properties: {} },
    nangoSyncName: "quickbooks-cash-balance",
    outputUnit: "$",
    enabled: true,
  },
  {
    provider: "shopify",
    key: "shopify.orders",
    label: "Shopify: Orders",
    description: "Count of orders placed this cycle.",
    configSchema: { type: "object", properties: {} },
    nangoSyncName: "shopify-orders",
    outputUnit: "count",
    enabled: true,
  },
  {
    provider: "shopify",
    key: "shopify.revenue",
    label: "Shopify: Revenue",
    description: "Gross merchandise value this cycle.",
    configSchema: { type: "object", properties: {} },
    nangoSyncName: "shopify-revenue",
    outputUnit: "$",
    enabled: true,
  },
  {
    provider: "zoho-bigin",
    key: "zoho-bigin.deals_won",
    label: "Zoho Bigin: Deals won",
    description: "Count of deals with stage = Closed Won.",
    configSchema: {
      type: "object",
      properties: {
        pipelineName: {
          type: "string",
          title: "Pipeline name (optional)",
        },
      },
    },
    nangoSyncName: "zoho-bigin-deals-won",
    outputUnit: "count",
    enabled: true,
  },
  {
    provider: "zoho-bigin",
    key: "zoho-bigin.pipeline_value",
    label: "Zoho Bigin: Pipeline value",
    description: "Sum of open deal amounts.",
    configSchema: {
      type: "object",
      properties: {
        pipelineName: {
          type: "string",
          title: "Pipeline name (optional)",
        },
      },
    },
    nangoSyncName: "zoho-bigin-pipeline-value",
    outputUnit: "$",
    enabled: true,
  },
];

let seeded = false;

/**
 * Upserts the metric definition catalog. Idempotent — `key` is unique, so
 * re-running is safe. Runs on first access within a process.
 */
export async function ensureMetricDefinitionsSeeded() {
  if (seeded) return;
  for (const def of DEFS) {
    await db
      .insert(metricDefinitions)
      .values(def)
      .onConflictDoUpdate({
        target: metricDefinitions.key,
        set: {
          label: def.label,
          description: def.description,
          configSchema: def.configSchema,
          nangoSyncName: def.nangoSyncName,
          outputUnit: def.outputUnit,
          enabled: def.enabled,
        },
      });
  }
  seeded = true;
}

// Tests reset this so each test run re-seeds cleanly.
export function _resetSeedingFlagForTests() {
  seeded = false;
}
