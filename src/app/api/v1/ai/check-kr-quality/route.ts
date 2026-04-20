import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { AI_MODEL, getAnthropic } from "@/lib/ai/client";
import { KR_QUALITY_SYSTEM } from "@/lib/ai/prompts";
import { BadRequestError } from "@/lib/errors";

const Input = z.object({
  title: z.string().min(1).max(400),
  krType: z.enum(["number", "percentage", "currency", "milestone"]),
  startValue: z.number(),
  targetValue: z.number(),
  unit: z.string().max(32).nullish(),
});

const OutputSchema = z.object({
  measurable: z.number().min(0).max(1),
  outcome_based: z.number().min(0).max(1),
  ambitious: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  suggestion: z.string().max(200).nullable(),
});

export const POST = withAuth<z.infer<typeof Input>>({
  input: Input,
  handler: async ({ input }) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      throw new BadRequestError(
        "AI features are not configured. Set ANTHROPIC_API_KEY.",
      );
    }

    const userMessage = [
      `Title: ${input.title}`,
      `Type: ${input.krType}`,
      `Start: ${input.startValue}${input.unit ? ` ${input.unit}` : ""}`,
      `Target: ${input.targetValue}${input.unit ? ` ${input.unit}` : ""}`,
    ].join("\n");

    const response = await anthropic.messages.parse({
      model: AI_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: KR_QUALITY_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              measurable: { type: "number" },
              outcome_based: { type: "number" },
              ambitious: { type: "number" },
              clarity: { type: "number" },
              suggestion: { type: ["string", "null"] },
            },
            required: [
              "measurable",
              "outcome_based",
              "ambitious",
              "clarity",
              "suggestion",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed =
      response.parsed_output ??
      OutputSchema.parse(
        JSON.parse(
          response.content.find((b) => b.type === "text")?.text ?? "{}",
        ),
      );
    return OutputSchema.parse(parsed);
  },
});
