"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import type { Team } from "@/lib/db/schema";

export function useTeams() {
  const { data, error, isLoading, mutate } = useSWR<Team[]>(
    "/api/v1/teams",
    apiGet,
  );
  return { teams: data ?? [], error, isLoading, mutate };
}

export type TeamMember = {
  id: string;
  teamId: string;
  userId: string;
  isLead: boolean;
  createdAt: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
};

export function useTeamMembers(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TeamMember[]>(
    teamId ? `/api/v1/teams/${teamId}/members` : null,
    apiGet,
  );
  return { members: data ?? [], error, isLoading, mutate };
}
