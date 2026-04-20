import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Returns the Anthropic SDK client, or null if ANTHROPIC_API_KEY isn't set.
 * The AI routes handle the null case gracefully (503 "AI not configured")
 * so local dev without the key still boots.
 */
export function getAnthropic(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export const AI_MODEL = "claude-opus-4-7";
