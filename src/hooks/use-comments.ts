"use client";

import useSWR from "swr";

import { apiGet } from "@/lib/api/client";

export type CommentRow = {
  id: string;
  entityType: "objective" | "key_result" | "check_in";
  entityId: string;
  authorUserId: string;
  body: string;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export function useComments(
  entityType: "objective" | "key_result" | "check_in" | null,
  entityId: string | null,
) {
  const key =
    entityType && entityId
      ? `/api/v1/comments?entityType=${entityType}&entityId=${entityId}`
      : null;
  const { data, error, isLoading, mutate } = useSWR<CommentRow[]>(
    key,
    apiGet,
  );
  return { comments: data ?? [], error, isLoading, mutate };
}
