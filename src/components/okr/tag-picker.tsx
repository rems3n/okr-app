"use client";

import useSWR from "swr";

import { useTags } from "@/hooks/use-tags";
import { apiGet, apiSend, ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type EntityType = "objective" | "key_result";

type EntityTag = { id: string; name: string; color: string };

/**
 * Read-and-apply chip list for tags on a single entity. Admin-created tags
 * live on /settings/tags (not yet — for now create inline via the
 * applyByName flow). Sprint 6 scope keeps this minimal: show applied tags,
 * let any member toggle one on/off, create-new via org settings later.
 */
export function TagPicker({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const { tags, mutate: mutateTags } = useTags();
  const key = `/api/v1/tags?entity=${entityType}:${entityId}`;
  const { data: applied = [], mutate: mutateApplied } = useSWR<EntityTag[]>(
    key,
    () =>
      apiGet<EntityTag[]>(
        `/api/v1/tags`,
      ).then(async (all) => {
        const res = await Promise.all(
          all.map(async (t) => {
            // No direct "tags for entity" endpoint yet; infer via /tags/apply probe.
            // For Sprint 6 we just read the full tag list + a marker.
            return t;
          }),
        );
        return res as EntityTag[];
      }),
  );
  // Scope: render known tags and let user apply. "Applied" state needs a
  // per-entity read; add that when the per-entity endpoint lands.
  void applied;
  void mutateApplied;

  const toggle = async (tag: EntityTag) => {
    try {
      await apiSend("/api/v1/tags/apply", "POST", {
        tagId: tag.id,
        entityType,
        entityId,
      });
      mutateTags();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  const createInline = async () => {
    const name = prompt("Tag name?");
    if (!name) return;
    try {
      const tag = await apiSend<{ id: string }>("/api/v1/tags", "POST", {
        name,
      });
      await apiSend("/api/v1/tags/apply", "POST", {
        tagId: tag.id,
        entityType,
        entityId,
      });
      mutateTags();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  if (tags.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        No tags yet.{" "}
        <button
          type="button"
          onClick={createInline}
          className="underline hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Create one
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t as EntityTag)}
          className={cn(
            "text-xs rounded-full px-2 py-0.5 border",
            "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          )}
          style={{
            backgroundColor: `${t.color}22`,
            borderColor: t.color,
            color: t.color,
          }}
        >
          {t.name}
        </button>
      ))}
      <button
        type="button"
        onClick={createInline}
        className="text-xs rounded-full px-2 py-0.5 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        + Tag
      </button>
    </div>
  );
}
