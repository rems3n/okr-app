"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useAvailableIntegrations,
  useMetricCatalog,
} from "@/hooks/use-integrations";
import type { MetricDefinition } from "@/lib/db/schema";

export type BindingDraft = {
  integrationConnectedId: string;
  metricDefinitionId: string;
  config: Record<string, unknown>;
};

/**
 * Optional data-source picker used inside the KR create dialog. Hidden until
 * the user toggles it on; validates that the selected metric's required
 * config fields are filled before reporting the draft upward.
 */
export function MetricBindingField({
  value,
  onChange,
}: {
  value: BindingDraft | null;
  onChange: (draft: BindingDraft | null) => void;
}) {
  const { integrations } = useAvailableIntegrations();
  const connected = integrations.filter(
    (i) => i.enabled && i.connection?.status === "active",
  );
  const [open, setOpen] = useState(Boolean(value));
  const [provider, setProvider] = useState<string>(
    connected[0]?.key ?? "",
  );
  const { definitions } = useMetricCatalog(open ? provider : null);
  const [definitionId, setDefinitionId] = useState<string>("");
  const [config, setConfig] = useState<Record<string, string>>({});

  const def: MetricDefinition | undefined = useMemo(
    () => definitions.find((d) => d.id === definitionId),
    [definitions, definitionId],
  );

  // Push draft up whenever the key pieces settle.
  useEffect(() => {
    if (!open) {
      onChange(null);
      return;
    }
    const integration = connected.find((i) => i.key === provider);
    if (!integration || !integration.connection || !definitionId) {
      onChange(null);
      return;
    }
    onChange({
      integrationConnectedId: integration.connection.id,
      metricDefinitionId: definitionId,
      config,
    });
  }, [open, provider, definitionId, config, connected, onChange]);

  if (connected.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 p-3 text-xs text-zinc-500">
        Connect an integration under{" "}
        <span className="underline">Settings → Integrations</span> to bind
        this KR to a live metric.
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
        />
        <span className="font-medium">Connect to a data source</span>
        <span className="text-zinc-500 text-xs">
          (auto-updates on sync)
        </span>
      </label>
      {open && (
        <div className="space-y-3">
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">
              Integration
            </span>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setDefinitionId("");
                setConfig({});
              }}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              {connected.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-zinc-700 dark:text-zinc-300">Metric</span>
            <select
              value={definitionId}
              onChange={(e) => setDefinitionId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">Pick one…</option>
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {def && (
            <ConfigFields
              def={def}
              value={config}
              onChange={setConfig}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ConfigFields({
  def,
  value,
  onChange,
}: {
  def: MetricDefinition;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  type SchemaField = {
    title?: string;
    type?: string;
    default?: string;
  };
  const schema = def.configSchema as {
    properties?: Record<string, SchemaField>;
    required?: string[];
  };
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return (
    <div className="space-y-2">
      {Object.entries(properties).map(([key, field]) => (
        <label key={key} className="block text-sm space-y-1">
          <span className="text-zinc-700 dark:text-zinc-300">
            {field.title ?? key}
            {required.has(key) && (
              <span className="text-red-500 ml-0.5">*</span>
            )}
          </span>
          <input
            value={value[key] ?? ""}
            required={required.has(key)}
            onChange={(e) =>
              onChange({ ...value, [key]: e.target.value })
            }
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </label>
      ))}
    </div>
  );
}
