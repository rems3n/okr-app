"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { User } from "@/lib/db/schema";

export function useMembers() {
  const { data, error, isLoading, mutate } = useSWR<User[]>(
    "/api/v1/users",
    apiGet,
  );
  return { members: data ?? [], error, isLoading, mutate };
}
