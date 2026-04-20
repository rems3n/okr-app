"use client";

import { useEffect, useRef, useState } from "react";

import { useMembers } from "@/hooks/use-members";

export type MentionPayload = {
  body: string;
  mentionedUserIds: string[];
};

/**
 * Textarea that lights up an @member suggestion popover when the caret is on
 * a token starting with "@". Selecting inserts "@Name" into the body and
 * records the corresponding userId in mentionedUserIds.
 */
export function MentionTextarea({
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
}: {
  value: MentionPayload;
  onChange: (v: MentionPayload) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { members } = useMembers();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(0);

  const suggestions = (() => {
    if (query === null) return [] as typeof members;
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  })();

  function tokenStart(body: string, cursor: number): number {
    for (let i = cursor - 1; i >= 0; i -= 1) {
      const c = body[i];
      if (c === "@") return i;
      if (c === " " || c === "\n") return -1;
    }
    return -1;
  }

  function detectMention(body: string, cursor: number) {
    const idx = tokenStart(body, cursor);
    if (idx < 0) {
      setQuery(null);
      return;
    }
    setAnchor(idx);
    setQuery(body.slice(idx + 1, cursor));
  }

  function select(member: { id: string; name: string }) {
    if (!ref.current) return;
    const body = value.body;
    const before = body.slice(0, anchor);
    const after = body.slice(ref.current.selectionStart);
    const inserted = `@${member.name} `;
    const nextBody = `${before}${inserted}${after}`;
    const nextMentions = Array.from(
      new Set([...value.mentionedUserIds, member.id]),
    );
    onChange({ body: nextBody, mentionedUserIds: nextMentions });
    setQuery(null);
    requestAnimationFrame(() => {
      const caret = before.length + inserted.length;
      ref.current?.setSelectionRange(caret, caret);
      ref.current?.focus();
    });
  }

  useEffect(() => {
    // Purge mentions whose name no longer appears in body (user deleted them).
    const stillPresent = value.mentionedUserIds.filter((id) => {
      const m = members.find((x) => x.id === id);
      return m ? value.body.includes(`@${m.name}`) : false;
    });
    if (stillPresent.length !== value.mentionedUserIds.length) {
      onChange({ body: value.body, mentionedUserIds: stillPresent });
    }
  }, [value.body, value.mentionedUserIds, members, onChange]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        value={value.body}
        onChange={(e) => {
          onChange({ ...value, body: e.target.value });
          detectMention(e.target.value, e.target.selectionStart);
        }}
        onKeyUp={(e) => {
          const t = e.currentTarget;
          detectMention(t.value, t.selectionStart);
        }}
        onBlur={() => {
          // Defer so a click on a suggestion can land.
          setTimeout(() => setQuery(null), 150);
        }}
        className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
      />
      {query !== null && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm max-h-48 overflow-y-auto">
          {suggestions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(m);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
