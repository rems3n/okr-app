import { Knock } from "@knocklabs/node";

let client: Knock | null = null;

/**
 * Lazy Knock client. Returns null when KNOCK_API_KEY is missing so dev and
 * builds without notifications wired up don't crash — every helper below
 * no-ops in that case.
 */
export function getKnock(): Knock | null {
  if (client) return client;
  const apiKey = process.env.KNOCK_API_KEY;
  if (!apiKey) return null;
  client = new Knock({ apiKey });
  return client;
}

export type IdentifyInput = {
  userId: string;
  email: string | null;
  name: string;
  organizationId: string;
};

/**
 * Idempotent upsert of a Knock user. Called from `getAuthContext` so the
 * user exists before we try to send them anything. Tolerates Knock outages
 * by swallowing failures (we don't want a Knock blip to take down auth).
 */
export async function identifyKnockUser(input: IdentifyInput): Promise<void> {
  const knock = getKnock();
  if (!knock) return;
  try {
    await knock.users.update(input.userId, {
      email: input.email ?? undefined,
      name: input.name,
      properties: { organization_id: input.organizationId },
    });
  } catch (err) {
    console.warn("Knock identify failed", { userId: input.userId, err });
  }
}

export type Recipient = string | { id: string; email?: string; name?: string };

/**
 * Fire a Knock workflow. `recipients` is one or more user IDs (strings) or
 * inline-identify objects. `data` is the per-trigger template payload.
 */
export async function triggerWorkflow(
  workflowKey: string,
  recipients: Recipient | Recipient[],
  data: Record<string, unknown> = {},
): Promise<void> {
  const knock = getKnock();
  if (!knock) return;
  const list = Array.isArray(recipients) ? recipients : [recipients];
  if (list.length === 0) return;
  try {
    await knock.workflows.trigger(workflowKey, {
      recipients: list,
      data,
    });
  } catch (err) {
    console.warn("Knock trigger failed", { workflowKey, err });
  }
}
