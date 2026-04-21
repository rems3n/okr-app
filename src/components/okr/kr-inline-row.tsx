"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ProgressBar } from "@/components/okr/objective-row";
import { ApiRequestError, apiSend } from "@/lib/api/client";
import type { KeyResult } from "@/lib/db/schema";
import { krProgress } from "@/lib/okr/progress";
import { cn } from "@/lib/utils";

type Confidence = "on_track" | "at_risk" | "off_track";

const CONFIDENCE_META: Record<
  Confidence | "no_data",
  { label: string; color: string }
> = {
  on_track: { label: "On track", color: "bg-emerald-500" },
  at_risk: { label: "At risk", color: "bg-amber-500" },
  off_track: { label: "Off track", color: "bg-red-500" },
  no_data: { label: "No check-in", color: "bg-zinc-300 dark:bg-zinc-700" },
};

export type KrInlineRowProps = {
  kr: Pick<
    KeyResult,
    | "id"
    | "title"
    | "krType"
    | "startValue"
    | "targetValue"
    | "currentValue"
    | "unit"
    | "progressMode"
    | "ownerUserId"
  >;
  objectiveHref: string;
  confidence: Confidence | "no_data";
  ownerName?: string | null;
  canEdit: boolean;
  onMutated?: () => void;
};

export function KrInlineRow({
  kr,
  objectiveHref,
  confidence,
  ownerName,
  canEdit,
  onMutated,
}: KrInlineRowProps) {
  const pct = krProgress(kr);
  return (
    <div className="flex items-center gap-3 py-1.5 pl-10 pr-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <ConfidenceButton
        keyResultId={kr.id}
        currentValue={kr.currentValue}
        confidence={confidence}
        canEdit={canEdit}
        onMutated={onMutated}
      />
      <Link
        href={objectiveHref}
        className="flex-1 min-w-0 truncate text-zinc-800 dark:text-zinc-200 hover:underline"
      >
        {kr.title}
      </Link>
      {ownerName && (
        <span className="text-xs text-zinc-500 hidden sm:inline">
          {ownerName}
        </span>
      )}
      <CurrentValueEditor
        keyResultId={kr.id}
        progressMode={kr.progressMode}
        currentValue={kr.currentValue}
        targetValue={kr.targetValue}
        unit={kr.unit}
        canEdit={canEdit}
        onMutated={onMutated}
      />
      <div className="w-24 shrink-0">
        <ProgressBar value={pct} width="w-20" />
      </div>
    </div>
  );
}

function ConfidenceButton({
  keyResultId,
  currentValue,
  confidence,
  canEdit,
  onMutated,
}: {
  keyResultId: string;
  currentValue: string;
  confidence: Confidence | "no_data";
  canEdit: boolean;
  onMutated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const meta = CONFIDENCE_META[confidence];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = async (value: Confidence) => {
    setBusy(true);
    try {
      await apiSend("/api/v1/check-ins", "POST", {
        keyResultId,
        newValue: Number(currentValue),
        confidence: value,
      });
      setOpen(false);
      onMutated?.();
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) {
    return (
      <span
        className={cn("h-2.5 w-2.5 rounded-full shrink-0", meta.color)}
        title={meta.label}
        aria-label={meta.label}
      />
    );
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Confidence: ${meta.label}`}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-700"
        disabled={busy}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.color)} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-lg py-1">
          {(["on_track", "at_risk", "off_track"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pick(c);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
              disabled={busy}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  CONFIDENCE_META[c].color,
                )}
              />
              {CONFIDENCE_META[c].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrentValueEditor({
  keyResultId,
  progressMode,
  currentValue,
  targetValue,
  unit,
  canEdit,
  onMutated,
}: {
  keyResultId: string;
  progressMode: "auto" | "manual";
  currentValue: string;
  targetValue: string;
  unit: string | null;
  canEdit: boolean;
  onMutated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const display =
    progressMode === "manual"
      ? `${Math.round(Number(currentValue))}%`
      : formatValue(currentValue, unit) +
        (targetValue ? ` / ${formatValue(targetValue, unit)}` : "");

  if (!canEdit || !editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }}
        className={cn(
          "text-xs tabular-nums w-28 text-right shrink-0",
          canEdit && "hover:underline",
        )}
        disabled={!canEdit || busy}
        title={canEdit ? "Click to edit" : undefined}
      >
        {display}
      </button>
    );
  }

  // Editing: remount the input each time we enter edit mode so `defaultValue`
  // reflects the latest server value without setState-in-effect.
  return (
    <CurrentValueInput
      defaultValue={currentValue}
      busy={busy}
      onCancel={() => setEditing(false)}
      onSubmit={async (raw) => {
        if (raw === currentValue) {
          setEditing(false);
          return;
        }
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          setEditing(false);
          return;
        }
        setBusy(true);
        try {
          await apiSend(`/api/v1/key-results/${keyResultId}`, "PATCH", {
            currentValue: num,
          });
          onMutated?.();
        } catch (err) {
          alert(err instanceof ApiRequestError ? err.message : "Failed");
        } finally {
          setBusy(false);
          setEditing(false);
        }
      }}
    />
  );
}

function CurrentValueInput({
  defaultValue,
  busy,
  onSubmit,
  onCancel,
}: {
  defaultValue: string;
  busy: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      autoFocus
      type="number"
      step="any"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSubmit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") onCancel();
      }}
      disabled={busy}
      className="w-28 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-0.5 text-xs tabular-nums text-right shrink-0"
    />
  );
}

function formatValue(raw: string, unit: string | null): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (unit === "$") return `$${n.toLocaleString()}`;
  if (unit === "%") return `${n}%`;
  return `${n}${unit ? ` ${unit}` : ""}`;
}
