"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { MetricDefinition } from "@/lib/db/schema";

export type AvailableIntegration = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  connection: {
    id: string;
    status: "active" | "error" | "disconnected";
    lastSyncedAt: string | null;
    errorMessage: string | null;
  } | null;
};

type AvailableIntegrationsResponse = {
  providers: AvailableIntegration[];
  nangoConfigured: boolean;
};

export function useAvailableIntegrations() {
  const { data, error, isLoading, mutate } =
    useSWR<AvailableIntegrationsResponse>(
      "/api/v1/integrations/available",
      apiGet,
    );
  return {
    integrations: data?.providers ?? [],
    nangoConfigured: data?.nangoConfigured ?? true,
    error,
    isLoading,
    mutate,
  };
}

export function useMetricCatalog(provider: string | null) {
  const key = provider
    ? `/api/v1/metrics/catalog?provider=${provider}&enabledOnly=true`
    : null;
  const { data, error, isLoading } = useSWR<MetricDefinition[]>(key, apiGet);
  return { definitions: data ?? [], error, isLoading };
}
