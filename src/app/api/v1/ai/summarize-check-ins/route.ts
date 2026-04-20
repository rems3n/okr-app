import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";

import { withAuth } from "@/lib/api/with-auth";
import { AI_MODEL, getAnthropic } from "@/lib/ai/client";
import { CHECK_IN_SUMMARY_SYSTEM } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import {
  checkIns,
  keyResults,
  objectives,
  users,
} from "@/lib/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/errors";

const Input = z.object({
  cycleId: z.uuid(),
  scope: z.enum(["team", "company"]).default("company"),
  teamId: z.uuid().nullish(),
});

export const POST = withAuth<z.infer<typeof Input>>({
  input: Input,
  handler: async ({ ctx, db: scoped, input }) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      throw new BadRequestError(
        "AI features are not configured. Set ANTHROPIC_API_KEY.",
      );
    }

    const cycle = await scoped.getCycleById(input.cycleId);
    if (!cycle) throw new NotFoundError("Cycle not found");

    // Gather objectives in scope.
    const objs = await scoped.listObjectives({
      cycleId: cycle.id,
      teamId: input.scope === "team" ? (input.teamId ?? undefined) : undefined,
    });
    if (objs.length === 0) {
      return {
        summary:
          "No objectives in this scope yet — nothing to summarize. Create a few objectives and check back after your first check-in cycle.",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      };
    }
    const objIds = objs.map((o) => o.id);
    const krRows = await db
      .select()
      .from(keyResults)
      .where(inArray(keyResults.objectiveId, objIds));
    if (krRows.length === 0) {
      return {
        summary: "Objectives exist but no KRs have been created yet.",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      };
    }
    const krIds = krRows.map((k) => k.id);
    const sinceWindow = new Date();
    sinceWindow.setDate(sinceWindow.getDate() - 7);
    const recentCheckIns = await db
      .select({
        ci: checkIns,
        krTitle: keyResults.title,
        authorName: users.name,
        objectiveTitle: objectives.title,
      })
      .from(checkIns)
      .innerJoin(keyResults, eq(keyResults.id, checkIns.keyResultId))
      .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
      .innerJoin(users, eq(users.id, checkIns.authorUserId))
      .where(
        and(
          inArray(checkIns.keyResultId, krIds),
          gte(checkIns.createdAt, sinceWindow),
        ),
      );
    if (recentCheckIns.length === 0) {
      return {
        summary:
          "No check-ins logged in the past week. Nudge KR owners through the check-in flow so we have signal for next week's review.",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      };
    }

    const lines = recentCheckIns
      .slice(0, 40)
      .map(
        (r) =>
          `- [${r.ci.confidence}] "${r.krTitle}" (${r.objectiveTitle}) by ${r.authorName}: ${r.ci.previousValue} → ${r.ci.newValue}${r.ci.note ? ` — ${r.ci.note}` : ""}`,
      )
      .join("\n");

    const userMessage = [
      `Cycle: ${cycle.name}`,
      `Scope: ${input.scope}`,
      `\nCheck-ins from the past week (${recentCheckIns.length} total):`,
      lines,
    ].join("\n");

    const response = await anthropic.messages.parse({
      model: AI_MODEL,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: CHECK_IN_SUMMARY_SYSTEM,
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
              summary: { type: "string" },
            },
            required: ["summary"],
            additionalProperties: false,
          },
        },
      },
      metadata: { user_id: ctx.userId },
    });

    const parsed =
      response.parsed_output ??
      JSON.parse(
        response.content.find((b) => b.type === "text")?.text ?? "{}",
      );
    return {
      summary: String(parsed.summary ?? ""),
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  },
});
