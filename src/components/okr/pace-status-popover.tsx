"use client";

import { useEffect, useRef, useState } from "react";

import { PaceDot } from "@/components/okr/objective-row";
import { ApiRequestError, apiSend } from "@/lib/api/client";
import type { Pace } from "@/lib/okr/progress";
import { cn } from "@/lib/utils";

type Option = { value: "auto" | Pace; label: string };

const OPTIONS: Option[] = [
  { value: "auto", label: "Auto (calculate from progress)" },
  { value: "ahead", label: "Ahead of pace" },
  { value: "on_pace", label: "On pace" },
  { value: "behind", label: "Behind pace" },
];

export function PaceStatusPopover({
  objectiveId,
  derivedStatus,
  override,
  canEdit,
  onChanged,
}: {
  objectiveId: string;
  derivedStatus: Pace | "no_data";
  override: Pace | null;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shown: Pace | "no_data" = override ?? derivedStatus;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!canEdit) {
    return <PaceDot status={shown} />;
  }

  const handlePick = async (value: Option["value"]) => {
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/v1/objectives/${objectiveId}`, "PATCH", {
        manualPaceStatus: value === "auto" ? null : value,
      });
      setOpen(false);
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Failed to save",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          override && "ring-1 ring-zinc-300 dark:ring-zinc-700",
        )}
        aria-label="Change pace status"
        disabled={saving}
      >
        <PaceDot status={shown} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-60 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-lg py-1">
          {OPTIONS.map((opt) => {
            const isActive =
              (opt.value === "auto" && !override) || opt.value === override;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePick(opt.value);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  isActive && "bg-zinc-50 dark:bg-zinc-900 font-medium",
                )}
                disabled={saving}
              >
                {opt.label}
              </button>
            );
          })}
          {override && (
            <p className="px-3 pt-1 pb-1.5 text-[11px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 mt-1">
              Derived: {derivedStatus.replace("_", " ")}
            </p>
          )}
          {error && (
            <p className="px-3 pb-2 text-[11px] text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
