"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { KeyResult, Objective } from "@/lib/db/schema";

export function useObjectives(cycleId: string | null) {
  const key = cycleId ? `/api/v1/objectives?cycleId=${cycleId}` : null;
  const { data, error, isLoading, mutate } = useSWR<Objective[]>(key, apiGet);
  return { objectives: data ?? [], error, isLoading, mutate };
}

export type ObjectiveDetail = {
  objective: Objective;
  cycleStatus: "planning" | "active" | "grading" | "closed" | null;
  keyResults: KeyResult[];
  children: Objective[];
  parent: Objective | null;
  bindingsByKr: Record<
    string,
    { provider: string; metricLabel: string; lastSyncedAt: string | null } | null
  >;
  scoresByKr: Record<
    string,
    { score: string; finalValue: string; reflection: string } | null
  >;
};

export function useObjective(objectiveId: string | null) {
  const key = objectiveId ? `/api/v1/objectives/${objectiveId}` : null;
  const { data, error, isLoading, mutate } = useSWR<ObjectiveDetail>(
    key,
    apiGet,
  );
  return { detail: data, error, isLoading, mutate };
}
