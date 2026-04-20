"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { CheckIn, KeyResult, Objective } from "@/lib/db/schema";

export type PendingKr = KeyResult & {
  objective: Objective;
  lastCheckInAt: string | null;
};

export function usePendingCheckIns() {
  const { data, error, isLoading, mutate } = useSWR<PendingKr[]>(
    "/api/v1/check-ins/pending",
    apiGet,
  );
  return { pending: data ?? [], error, isLoading, mutate };
}

export function useCheckInsForKr(keyResultId: string | null) {
  const key = keyResultId
    ? `/api/v1/check-ins?keyResultId=${keyResultId}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<CheckIn[]>(key, apiGet);
  return { checkIns: data ?? [], error, isLoading, mutate };
}

export type ObjectiveCheckIn = CheckIn & {
  keyResultTitle: string;
  authorName: string;
};

export function useCheckInsForObjective(objectiveId: string | null) {
  const key = objectiveId
    ? `/api/v1/check-ins?objectiveId=${objectiveId}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<ObjectiveCheckIn[]>(
    key,
    apiGet,
  );
  return { checkIns: data ?? [], error, isLoading, mutate };
}
