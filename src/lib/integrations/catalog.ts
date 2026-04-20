/**
 * Static catalog of integration providers we intend to support.
 * Each provider maps 1:1 to a Nango integration key. Only providers with
 * `enabled: true` have working OAuth + syncs today; the others render in the
 * catalog UI as "Coming soon" so customers can see the roadmap.
 */
export type ProviderDef = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    key: "linear",
    label: "Linear",
    description: "Pull issue + cycle progress from your Linear workspace.",
    enabled: true,
  },
  {
    key: "slack",
    label: "Slack",
    description: "Track activity in the channels that matter.",
    enabled: true,
  },
  {
    key: "jira",
    label: "Jira",
    description: "Issue throughput and sprint completion.",
    enabled: true,
  },
  {
    key: "quickbooks",
    label: "QuickBooks",
    description: "Revenue, expenses, cash position straight from QBO.",
    enabled: true,
  },
  {
    key: "shopify",
    label: "Shopify",
    description: "Orders, revenue, and new customers from your store.",
    enabled: true,
  },
  {
    key: "zoho-bigin",
    label: "Zoho Bigin",
    description: "Deal pipeline + win rate from your Bigin CRM.",
    enabled: true,
  },
];

export function getProvider(key: string): ProviderDef | null {
  return PROVIDERS.find((p) => p.key === key) ?? null;
}
