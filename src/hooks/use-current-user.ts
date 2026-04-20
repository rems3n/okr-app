"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { User } from "@/lib/db/schema";

export type CurrentUserResponse = {
  user: User;
  managerUserId: string | null;
};

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUserResponse>(
    "/api/v1/users/me",
    apiGet,
  );
  return { me: data, error, isLoading, mutate };
}
