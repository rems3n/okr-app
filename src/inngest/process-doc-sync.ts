import { and, eq, inArray } from "drizzle-orm";

import { chunkText, embedTexts } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import {
  documentChunks,
  documents,
  integrationsConnected,
} from "@/lib/db/schema";
import { parseConnectionId } from "@/lib/integrations/nango";
import { inngest } from "@/lib/inngest/client";

type NangoDocRecord = Record<string, unknown> & {
  id?: string;
  source_id?: string;
  title?: string;
  url?: string;
  content?: string;
  text?: string;
  body?: string;
  updated_at?: string;
  modified_at?: string;
};

type NangoWebhookPayload = {
  connectionId?: string;
  syncName?: string;
  records?: NangoDocRecord[];
  modifiedRecords?: NangoDocRecord[];
};

function pickContent(r: NangoDocRecord): string {
  return String(r.content ?? r.text ?? r.body ?? "").trim();
}

function pickSourceId(r: NangoDocRecord): string | null {
  return r.source_id ?? r.id ?? null;
}

/**
 * Re-embeds documents that arrived via a Notion or Drive Nango sync.
 * Triggered by `doc/sync.completed` events the main Nango dispatcher emits
 * for any sync whose provider is in DOC_SYNC_PROVIDERS.
 */
export const processDocSync = inngest.createFunction(
  {
    id: "process-doc-sync",
    triggers: [{ event: "doc/sync.completed" }],
  },
  async ({ event, step, logger }) => {
    const payload = event.data as NangoWebhookPayload;
    const connectionId = payload.connectionId;
    if (!connectionId) {
      logger.warn("doc/sync.completed missing connectionId");
      return;
    }
    const parsed = parseConnectionId(connectionId);
    if (!parsed) {
      logger.warn(`Bad connectionId ${connectionId}`);
      return;
    }

    const [integration] = await db
      .select()
      .from(integrationsConnected)
      .where(eq(integrationsConnected.nangoConnectionId, connectionId))
      .limit(1);
    if (!integration) {
      logger.warn(`No integration row for ${connectionId}`);
      return;
    }

    const records = payload.records ?? payload.modifiedRecords ?? [];
    if (records.length === 0) {
      logger.info(`No records in doc sync for ${integration.provider}`);
      return;
    }

    await step.run(`upsert-${records.length}`, async () => {
      for (const r of records) {
        const sourceId = pickSourceId(r);
        const content = pickContent(r);
        if (!sourceId || content.length === 0) continue;
        const title = String(r.title ?? "Untitled");
        const sourceUrl = r.url ? String(r.url) : null;
        const sourceUpdatedAt = r.updated_at ?? r.modified_at;

        // Upsert the document row.
        const [doc] = await db
          .insert(documents)
          .values({
            organizationId: integration.organizationId,
            integrationConnectedId: integration.id,
            provider: integration.provider,
            sourceId,
            sourceUrl,
            title,
            sourceUpdatedAt: sourceUpdatedAt
              ? new Date(sourceUpdatedAt)
              : null,
          })
          .onConflictDoUpdate({
            target: [
              documents.organizationId,
              documents.provider,
              documents.sourceId,
            ],
            set: {
              title,
              sourceUrl,
              sourceUpdatedAt: sourceUpdatedAt
                ? new Date(sourceUpdatedAt)
                : null,
              updatedAt: new Date(),
            },
          })
          .returning();

        const chunks = chunkText(content);
        if (chunks.length === 0) continue;

        const embeddings = await embedTexts(chunks.map((c) => c.content));
        if (!embeddings) {
          logger.warn(
            "OPENAI_API_KEY not set; skipping embeddings (chunks dropped)",
          );
          continue;
        }

        // Replace existing chunks for this document.
        await db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));
        await db.insert(documentChunks).values(
          chunks.map((chunk, idx) => ({
            documentId: doc.id,
            organizationId: integration.organizationId,
            chunkIndex: idx,
            content: chunk.content,
            embedding: embeddings[idx],
            tokens: chunk.tokens,
          })),
        );
      }
    });

    // Touch last_synced_at on the integration.
    await db
      .update(integrationsConnected)
      .set({ lastSyncedAt: new Date() })
      .where(eq(integrationsConnected.id, integration.id));
  },
);

// Suppress unused-import warning on `and`/`inArray` reserved for future
// pruning logic (delete documents not present in latest sync).
void and;
void inArray;
