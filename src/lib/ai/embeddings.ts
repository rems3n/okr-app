import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

/**
 * Embed up to N strings in one batch. Returns null when OPENAI_API_KEY is
 * missing so the caller can no-op cleanly. Throws on API errors so the
 * Inngest worker can retry.
 */
export async function embedTexts(
  inputs: string[],
): Promise<number[][] | null> {
  if (inputs.length === 0) return [];
  const openai = getOpenAI();
  if (!openai) return null;
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: inputs,
  });
  return res.data.map((d) => d.embedding);
}

/**
 * Splits a body of text into roughly token-bounded chunks with overlap.
 * Approximates "tokens" via char length / 4 — close enough for chunking
 * decisions and avoids importing a tokenizer.
 */
export function chunkText(
  text: string,
  opts: { targetTokens?: number; overlapTokens?: number } = {},
): { content: string; tokens: number }[] {
  const targetTokens = opts.targetTokens ?? 600;
  const overlapTokens = opts.overlapTokens ?? 50;
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;
  const cleaned = text.replace(/\r\n?/g, "\n").trim();
  if (cleaned.length === 0) return [];

  const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks: { content: string; tokens: number }[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim().length === 0) return;
    chunks.push({
      content: buf.trim(),
      tokens: Math.ceil(buf.length / 4),
    });
    // Keep the last overlapChars of the previous chunk as the seed for
    // continuity — preserves cross-paragraph meaning.
    buf = buf.slice(Math.max(0, buf.length - overlapChars));
  };
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > targetChars && buf.length > 0) {
      flush();
    }
    buf = (buf ? `${buf}\n\n` : "") + p;
    while (buf.length > targetChars) {
      // Hard split very long paragraphs to keep chunks bounded.
      chunks.push({
        content: buf.slice(0, targetChars),
        tokens: targetTokens,
      });
      buf = buf.slice(targetChars - overlapChars);
    }
  }
  flush();
  return chunks;
}
