import type { KeyResult, Objective } from "@/lib/db/schema";

/**
 * Fields whose changes trigger a new objective_versions row. `progress` and
 * `updated_at` don't — they're derived and noisy.
 */
export const OBJECTIVE_VERSIONED_FIELDS = [
  "title",
  "description",
  "parentObjectiveId",
  "teamId",
  "status",
] as const satisfies readonly (keyof Objective)[];

/**
 * Fields whose changes trigger a new key_result_versions row. `current_value`
 * is NOT here — that's captured via check-ins, not versioning.
 */
export const KR_VERSIONED_FIELDS = [
  "title",
  "krType",
  "startValue",
  "targetValue",
  "unit",
] as const satisfies readonly (keyof KeyResult)[];

export function needsObjectiveVersion(
  before: Objective,
  patch: Partial<Objective>,
): boolean {
  return OBJECTIVE_VERSIONED_FIELDS.some(
    (k) => k in patch && (patch as Record<string, unknown>)[k] !== before[k],
  );
}

export function needsKrVersion(
  before: KeyResult,
  patch: Partial<KeyResult>,
): boolean {
  return KR_VERSIONED_FIELDS.some(
    (k) => k in patch && (patch as Record<string, unknown>)[k] !== before[k],
  );
}
