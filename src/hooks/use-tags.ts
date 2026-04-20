"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { Tag } from "@/lib/db/schema";

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<Tag[]>(
    "/api/v1/tags",
    apiGet,
  );
  return { tags: data ?? [], error, isLoading, mutate };
}
