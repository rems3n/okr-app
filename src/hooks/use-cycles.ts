"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { Cycle } from "@/lib/db/schema";

export function useCycles() {
  const { data, error, isLoading, mutate } = useSWR<Cycle[]>(
    "/api/v1/cycles",
    apiGet,
  );
  return { cycles: data ?? [], error, isLoading, mutate };
}

export function useActiveCycle() {
  const { cycles, isLoading, mutate } = useCycles();
  const active = cycles.find((c) => c.status === "active") ?? null;
  return { active, cycles, isLoading, mutate };
}
