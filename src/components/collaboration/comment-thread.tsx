"use client";

import { useState } from "react";

import {
  MentionTextarea,
  type MentionPayload,
} from "@/components/collaboration/mention-textarea";
import { useComments, type CommentRow } from "@/hooks/use-comments";
import { apiSend, ApiRequestError } from "@/lib/api/client";

type EntityType = "objective" | "key_result" | "check_in";

export function CommentThread({
  entityType,
  entityId,
  currentUserId,
}: {
  entityType: EntityType;
  entityId: string;
  currentUserId: string;
}) {
  const { comments, isLoading, mutate } = useComments(entityType, entityId);
  const [draft, setDraft] = useState<MentionPayload>({
    body: "",
    mentionedUserIds: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/v1/comments", "POST", {
        entityType,
        entityId,
        body: draft.body,
        mentionedUserIds: draft.mentionedUserIds,
      });
      setDraft({ body: "", mentionedUserIds: [] });
      mutate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Comments</h2>
      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ol className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canEdit={c.authorUserId === currentUserId}
              onChange={mutate}
            />
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="space-y-2">
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Add a comment. @name to mention."
          disabled={busy}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !draft.body.trim()}
            className="text-sm rounded-md bg-zinc-900 text-white px-3 py-1.5 dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  onChange,
}: {
  comment: CommentRow;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MentionPayload>({
    body: comment.body,
    mentionedUserIds: comment.mentionedUserIds,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/v1/comments/${comment.id}`, "PATCH", {
        body: draft.body,
        mentionedUserIds: draft.mentionedUserIds,
      });
      setEditing(false);
      onChange();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm("Delete this comment?")) return;
    try {
      await apiSend(`/api/v1/comments/${comment.id}`, "DELETE");
      onChange();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="text-sm">
          <span className="font-medium">{comment.authorName}</span>
          <span className="text-xs text-zinc-500 ml-2">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        {canEdit && !editing && (
          <div className="flex gap-2 text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={del}
              className="hover:text-red-600"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <MentionTextarea value={draft} onChange={setDraft} />
          <div className="flex gap-2 justify-end text-sm">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-2 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {comment.body}
        </p>
      )}
    </li>
  );
}
