import { sql } from "drizzle-orm";

import { embedTexts } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";

export type RagChunk = {
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  content: string;
  similarity: number;
};

/**
 * Cosine-similarity search for the top-k most relevant document_chunks in
 * an org. Returns an empty array when:
 *   - the query string is empty
 *   - OPENAI_API_KEY isn't set (embedTexts returns null)
 *   - the org has no embedded chunks yet
 */
export async function retrieveContext(
  organizationId: string,
  query: string,
  k = 6,
): Promise<RagChunk[]> {
  if (!query.trim()) return [];
  const embeddings = await embedTexts([query]);
  if (!embeddings || embeddings.length === 0) return [];
  const vec = embeddings[0];
  // Drizzle's vector type maps JSON string into pgvector's text format.
  const literal = `[${vec.join(",")}]`;
  // Raw SQL because Drizzle's vector ops aren't first-class yet.
  // Cosine distance: 0 = identical, 2 = opposite. Similarity = 1 - distance.
  const rows = await db.execute(sql`
    SELECT
      dc.document_id,
      d.title       AS document_title,
      d.source_url  AS source_url,
      dc.content,
      (1 - (dc.embedding <=> ${literal}::vector))::float AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.organization_id = ${organizationId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${literal}::vector
    LIMIT ${k}
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    documentId: String(r.document_id),
    documentTitle: String(r.document_title ?? "Untitled"),
    sourceUrl: r.source_url ? String(r.source_url) : null,
    content: String(r.content),
    similarity: Number(r.similarity ?? 0),
  }));
}

export function formatChunksForPrompt(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(
    (c, i) =>
      `[${i + 1}] ${c.documentTitle}${c.sourceUrl ? ` (${c.sourceUrl})` : ""}\n${c.content}`,
  );
  return `\n\nRelevant context from your team's documents (cite by [n] only when directly relevant):\n${blocks.join("\n\n---\n\n")}`;
}
