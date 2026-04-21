"use client";

import { useState } from "react";

import {
  useAvailableIntegrations,
  type AvailableIntegration,
} from "@/hooks/use-integrations";
import { apiSend, ApiRequestError } from "@/lib/api/client";
import { can, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

export function IntegrationsPage({ currentRole }: { currentRole: Role }) {
  const { integrations, nangoConfigured, isLoading, mutate } =
    useAvailableIntegrations();
  const canConnect = can(currentRole, "integrations.connect");
  const canAdmin = can(currentRole, "team.manage");
  const [error, setError] = useState<string | null>(null);

  const connect = async (provider: AvailableIntegration) => {
    setError(null);
    try {
      const session = await apiSend<{
        sessionToken: string;
        provider: string;
      }>("/api/v1/integrations/connect", "POST", { provider: provider.key });
      // Dynamic import so @nangohq/frontend stays out of SSR bundles.
      const { default: Nango } = await import("@nangohq/frontend");
      const nango = new Nango({ connectSessionToken: session.sessionToken });
      let ui: ReturnType<typeof nango.openConnectUI> | null = null;
      ui = nango.openConnectUI({
        sessionToken: session.sessionToken,
        onEvent: async (event) => {
          if (event.type === "connect") {
            try {
              await apiSend(
                "/api/v1/integrations/nango-session-callback",
                "POST",
                {
                  provider: provider.key,
                  connectionId: event.payload.connectionId,
                },
              );
              await mutate();
            } catch (err) {
              setError(
                err instanceof ApiRequestError ? err.message : String(err),
              );
            } finally {
              ui?.close();
            }
          } else if (event.type === "error") {
            setError(event.payload.errorMessage);
            ui?.close();
          }
        },
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    }
  };

  const disconnect = async (integration: AvailableIntegration) => {
    if (!integration.connection) return;
    if (!confirm(`Disconnect ${integration.label}?`)) return;
    try {
      await apiSend(
        `/api/v1/integrations/${integration.connection.id}`,
        "DELETE",
      );
      mutate();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-zinc-500">
          Connect tools your team already uses so KRs update themselves.
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-500 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 bg-red-50 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {!isLoading && !nangoConfigured && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 space-y-2 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Nango isn&apos;t configured yet
          </p>
          <p className="text-amber-800/80 dark:text-amber-300/80">
            Integrations run through Nango. Connecting any provider below
            will fail until the server has Nango credentials.
          </p>
          {canAdmin ? (
            <ol className="list-decimal list-inside text-xs text-amber-800/80 dark:text-amber-300/80 space-y-0.5">
              <li>
                Create a project at{" "}
                <a
                  className="underline"
                  href="https://app.nango.dev"
                  target="_blank"
                  rel="noreferrer"
                >
                  app.nango.dev
                </a>
                .
              </li>
              <li>
                In Railway &rarr; okr-app &rarr; Variables, set{" "}
                <code>NANGO_SECRET_KEY</code>,{" "}
                <code>NEXT_PUBLIC_NANGO_PUBLIC_KEY</code>, and{" "}
                <code>NANGO_WEBHOOK_SECRET</code>.
              </li>
              <li>
                Point Nango&apos;s webhook URL at{" "}
                <code>/api/webhooks/nango</code> on this deploy and redeploy.
              </li>
            </ol>
          ) : (
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              Ask an admin to finish Nango setup.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((i) => (
            <IntegrationCard
              key={i.key}
              integration={i}
              canConnect={canConnect}
              onConnect={() => connect(i)}
              onDisconnect={() => disconnect(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function IntegrationCard({
  integration: i,
  canConnect,
  onConnect,
  onDisconnect,
}: {
  integration: AvailableIntegration;
  canConnect: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected =
    i.connection && i.connection.status !== "disconnected";
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 bg-white dark:bg-zinc-950 flex flex-col gap-3",
        i.enabled
          ? "border-zinc-200 dark:border-zinc-800"
          : "border-dashed border-zinc-200 dark:border-zinc-800 opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{i.label}</p>
        {!i.enabled && (
          <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-500">
            Coming soon
          </span>
        )}
        {connected && (
          <span
            className={cn(
              "text-xs rounded-full px-2 py-0.5",
              i.connection?.status === "active"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
            )}
          >
            {i.connection?.status}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-500 flex-1">{i.description}</p>
      {connected && i.connection?.lastSyncedAt && (
        <p className="text-xs text-zinc-500">
          Last sync: {new Date(i.connection.lastSyncedAt).toLocaleString()}
        </p>
      )}
      {connected && i.connection?.errorMessage && (
        <p className="text-xs text-red-500">{i.connection.errorMessage}</p>
      )}
      <div>
        {!i.enabled ? (
          <button
            type="button"
            disabled
            className="text-sm rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-400 cursor-not-allowed"
          >
            Coming soon
          </button>
        ) : connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={!canConnect}
            className="text-sm rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={!canConnect}
            className="text-sm rounded-md bg-zinc-900 text-white px-3 py-1.5 dark:bg-zinc-50 dark:text-zinc-900 disabled:opacity-50"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
