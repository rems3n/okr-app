import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { AI_MODEL, getAnthropic } from "@/lib/ai/client";
import { DRAFT_OBJECTIVES_SYSTEM } from "@/lib/ai/prompts";
import { formatChunksForPrompt, retrieveContext } from "@/lib/ai/rag";
import { BadRequestError, NotFoundError } from "@/lib/errors";

const Input = z.object({
  cycleId: z.uuid(),
  level: z.enum(["company", "team", "individual"]),
  teamId: z.uuid().nullish(),
  context: z.string().max(2000).optional(),
});

const KrSuggestion = z.object({
  title: z.string().min(1).max(200),
  krType: z.enum(["number", "percentage", "currency", "milestone"]),
  startValue: z.number(),
  targetValue: z.number(),
  unit: z.string().max(32).nullish(),
});

const ObjectiveSuggestion = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullish(),
  keyResults: z.array(KrSuggestion).min(2).max(3),
});

const OutputSchema = z.object({
  objectives: z.array(ObjectiveSuggestion).min(3).max(5),
});

export const POST = withAuth<z.infer<typeof Input>>({
  input: Input,
  handler: async ({ ctx, db, input }) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      throw new BadRequestError(
        "AI features are not configured. Set ANTHROPIC_API_KEY.",
      );
    }

    const cycle = await db.getCycleById(input.cycleId);
    if (!cycle) throw new NotFoundError("Cycle not found");

    const org = await db.getOrganization();
    const existing = await db.listObjectives({ cycleId: cycle.id });
    const team =
      input.teamId ? await db.getTeamById(input.teamId) : null;

    // RAG: pull relevant doc chunks if any exist for this org. Query string
    // is the user's free-text context if provided, else the team/level
    // signal. No-op without OPENAI_API_KEY or when nothing's been ingested.
    const ragQuery = (
      input.context ??
      [team?.name, input.level, "objectives", "metrics"].filter(Boolean).join(" ")
    ).slice(0, 1000);
    const ragChunks = await retrieveContext(ctx.orgId, ragQuery, 6);

    // User message carries per-request context. System prompt stays stable
    // across calls so the prefix caches.
    const userContext = [
      `Organization: ${org?.name ?? "Unknown"}`,
      `Cycle: ${cycle.name} (${cycle.startDate} → ${cycle.endDate})`,
      `Level: ${input.level}`,
      team ? `Team: ${team.name}` : null,
      existing.length > 0
        ? `Existing objectives in this cycle:\n${existing
            .map((o) => `- ${o.title}`)
            .join("\n")}`
        : "No existing objectives yet — this is a clean slate.",
      input.context ? `\nAdditional context from user:\n${input.context}` : null,
      formatChunksForPrompt(ragChunks),
      `\nDraft ${input.level}-level objectives.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await anthropic.messages.parse({
        model: AI_MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: DRAFT_OBJECTIVES_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userContext }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                objectives: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: ["string", "null"] },
                      keyResults: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            krType: {
                              type: "string",
                              enum: [
                                "number",
                                "percentage",
                                "currency",
                                "milestone",
                              ],
                            },
                            startValue: { type: "number" },
                            targetValue: { type: "number" },
                            unit: { type: ["string", "null"] },
                          },
                          required: [
                            "title",
                            "krType",
                            "startValue",
                            "targetValue",
                            "unit",
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["title", "description", "keyResults"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["objectives"],
              additionalProperties: false,
            },
          },
        },
        metadata: { user_id: ctx.userId },
      });

      const parsed =
        response.parsed_output ??
        OutputSchema.parse(
          JSON.parse(
            response.content.find((b) => b.type === "text")?.text ?? "{}",
          ),
        );
      const validated = OutputSchema.parse(parsed);
      return {
        objectives: validated.objectives,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          cacheRead: response.usage.cache_read_input_tokens ?? 0,
          cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (err) {
      console.error("draft-objectives failed", err);
      throw new BadRequestError(
        err instanceof Error ? err.message : "Draft failed",
      );
    }
  },
});
