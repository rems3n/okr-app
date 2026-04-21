"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Header-level "+ New" dropdown so users can create core entities from any
 * page. Each item routes to the relevant page with `?create=1` so the target
 * page auto-opens its create dialog (see objectives-page, cycles-page).
 */
export function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-1 rounded-md bg-zinc-900 text-white px-2.5 py-1 text-sm dark:bg-zinc-50 dark:text-zinc-900"
      >
        <Plus className="h-3.5 w-3.5" />
        New
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-48 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md py-1"
        >
          <MenuItem
            href="/objectives?create=1"
            label="New objective"
            hint="3 KRs ladder up"
            onClick={() => setOpen(false)}
          />
          <MenuItem
            href="/objectives?draft=1"
            label="Draft with AI"
            hint="3–5 suggestions"
            onClick={() => setOpen(false)}
          />
          <MenuItem
            href="/settings/cycles?create=1"
            label="New cycle"
            hint="Quarterly is typical"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  label,
  hint,
  onClick,
}: {
  href: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      <span>{label}</span>
      <span className="text-xs text-zinc-500">{hint}</span>
    </Link>
  );
}
