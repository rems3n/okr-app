import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { AI_MODEL, getAnthropic } from "@/lib/ai/client";
import { WEEKLY_RISK_SYSTEM } from "@/lib/ai/prompts";
import { formatChunksForPrompt, retrieveContext } from "@/lib/ai/rag";
import { db } from "@/lib/db";
import {
  checkIns,
  cycles,
  keyResults,
  objectives,
  organizations,
  users,
} from "@/lib/db/schema";
import { scopedDb } from "@/lib/db/scoped";
import { sendEmail } from "@/lib/email/send";
import { inngest } from "@/lib/inngest/client";

const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://okr-app-production-46c5.up.railway.app";

type Risk = {
  kr_or_objective: string;
  why: string;
  suggested_action: string;
};

type RiskReport = {
  headline: string;
  risks: Risk[];
  wins: string[];
  watch_next_week: string[];
};

const RiskReportSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kr_or_objective: { type: "string" },
          why: { type: "string" },
          suggested_action: { type: "string" },
        },
        required: ["kr_or_objective", "why", "suggested_action"],
        additionalProperties: false,
      },
    },
    wins: { type: "array", items: { type: "string" } },
    watch_next_week: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "risks", "wins", "watch_next_week"],
  additionalProperties: false,
} as const;

/**
 * Friday 13:00 UTC (09:00 ET). Writes each org a concise weekly risk digest
 * grounded in the past 7 days of check-ins, current KR confidence, and any
 * docs indexed via the Notion/Drive RAG pipeline. Emails admins + owners.
 * No-ops when ANTHROPIC_API_KEY isn't configured.
 */
export const weeklyRiskAnalyst = inngest.createFunction(
  {
    id: "weekly-risk-analyst",
    triggers: [{ cron: "0 13 * * 5" }],
  },
  async ({ step, logger }) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      logger.warn("ANTHROPIC_API_KEY not set; skipping weekly risk analyst");
      return;
    }

    const orgs = await step.run("list-orgs", () =>
      db.select().from(organizations),
    );

    for (const org of orgs) {
      await step.run(`org-${org.id}`, async () => {
        const [activeCycle] = await db
          .select()
          .from(cycles)
          .where(
            and(
              eq(cycles.organizationId, org.id),
              eq(cycles.status, "active"),
            ),
          )
          .limit(1);
        if (!activeCycle) {
          logger.info(`Skipping ${org.name}: no active cycle`);
          return;
        }

        const scoped = scopedDb(org.id);
        const krRows = await scoped.listKrsForCycle(activeCycle.id);
        if (krRows.length === 0) {
          logger.info(`Skipping ${org.name}: cycle has no KRs`);
          return;
        }

        const krIds = krRows.map((r) => r.kr.id);
        const latest = await scoped.latestCheckInsFor(krIds);
        const latestById = new Map(latest.map((l) => [l.keyResultId, l]));

        const sinceWindow = new Date();
        sinceWindow.setDate(sinceWindow.getDate() - 7);
        const recent = await db
          .select({
            ci: checkIns,
            krTitle: keyResults.title,
            objectiveTitle: objectives.title,
            authorName: users.name,
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
          )
          .orderBy(desc(checkIns.createdAt));

        const atRisk = krRows.filter((r) => {
          const last = latestById.get(r.kr.id);
          return last?.confidence === "at_risk" || last?.confidence === "off_track";
        });

        if (recent.length === 0 && atRisk.length === 0) {
          logger.info(`Skipping ${org.name}: nothing to report`);
          return;
        }

        const atRiskLines = atRisk
          .slice(0, 20)
          .map((r) => {
            const c = latestById.get(r.kr.id)?.confidence ?? "unknown";
            return `- [${c}] "${r.kr.title}" (${r.obj.title}) — owner ${r.ownerName}`;
          })
          .join("\n");
        const checkInLines = recent
          .slice(0, 40)
          .map(
            (r) =>
              `- [${r.ci.confidence}] "${r.krTitle}" (${r.objectiveTitle}) by ${r.authorName}: ${r.ci.previousValue} → ${r.ci.newValue}${r.ci.note ? ` — ${r.ci.note}` : ""}`,
          )
          .join("\n");

        const ragQuery = [
          org.name,
          activeCycle.name,
          "risks blockers concerns",
          atRisk
            .slice(0, 5)
            .map((r) => r.kr.title)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 1000);
        const ragChunks = await retrieveContext(org.id, ragQuery, 4);

        const userMessage = [
          `Organization: ${org.name}`,
          `Cycle: ${activeCycle.name} (${activeCycle.startDate} → ${activeCycle.endDate})`,
          atRisk.length > 0
            ? `\nKRs currently flagged at_risk or off_track (${atRisk.length}):\n${atRiskLines}`
            : "\nNo KRs currently flagged at_risk or off_track.",
          recent.length > 0
            ? `\nCheck-ins from the past week (${recent.length} total):\n${checkInLines}`
            : "\nNo check-ins logged in the past week.",
          formatChunksForPrompt(ragChunks),
        ]
          .filter(Boolean)
          .join("\n");

        const response = await anthropic.messages.parse({
          model: AI_MODEL,
          max_tokens: 1024,
          system: [
            {
              type: "text",
              text: WEEKLY_RISK_SYSTEM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
          output_config: {
            format: { type: "json_schema", schema: RiskReportSchema },
          },
          metadata: { user_id: `org-${org.id}` },
        });

        const report: RiskReport =
          response.parsed_output ??
          JSON.parse(
            response.content.find((b) => b.type === "text")?.text ?? "{}",
          );

        const recipients = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.organizationId, org.id),
              inArray(users.role, ["owner", "admin"]),
            ),
          );
        if (recipients.length === 0) {
          logger.info(`No admins/owners for ${org.name}; report not emailed`);
          return;
        }

        const link = `${APP_URL()}/dashboard`;
        const html = renderHtml({ orgName: org.name, cycleName: activeCycle.name, report, link });
        const text = renderText({ orgName: org.name, cycleName: activeCycle.name, report, link });

        for (const user of recipients) {
          if (!user.email) continue;
          await sendEmail({
            to: user.email,
            subject: `Weekly risk digest — ${activeCycle.name}`,
            text,
            html,
          });
        }
        logger.info(
          `Weekly risk digest sent to ${recipients.length} admins at ${org.name}`,
        );
      });
    }
  },
);

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHtml(args: {
  orgName: string;
  cycleName: string;
  report: RiskReport;
  link: string;
}): string {
  const { report, orgName, cycleName, link } = args;
  const risksHtml = report.risks
    .map(
      (r) => `
    <li style="margin-bottom:14px">
      <div style="font-weight:600">${escape(r.kr_or_objective)}</div>
      <div style="color:#444">${escape(r.why)}</div>
      <div style="color:#666;font-size:13px;margin-top:4px">→ ${escape(r.suggested_action)}</div>
    </li>`,
    )
    .join("");
  const winsHtml =
    report.wins.length > 0
      ? `<h3 style="margin-top:24px">Wins</h3><ul>${report.wins
          .map((w) => `<li>${escape(w)}</li>`)
          .join("")}</ul>`
      : "";
  const watchHtml =
    report.watch_next_week.length > 0
      ? `<h3 style="margin-top:24px">Watch next week</h3><ul>${report.watch_next_week
          .map((w) => `<li>${escape(w)}</li>`)
          .join("")}</ul>`
      : "";
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
    <div style="color:#666;font-size:13px">Weekly risk digest — ${escape(orgName)} · ${escape(cycleName)}</div>
    <h1 style="font-size:20px;margin:8px 0 20px">${escape(report.headline)}</h1>
    ${report.risks.length > 0 ? `<h3>Top risks</h3><ul style="padding-left:20px">${risksHtml}</ul>` : "<p>No material risks this week.</p>"}
    ${winsHtml}
    ${watchHtml}
    <p style="margin-top:28px"><a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open dashboard</a></p>
    <p style="color:#888;font-size:12px;margin-top:28px">You're receiving this as an admin of ${escape(orgName)}. Manage preferences in /settings/profile.</p>
  </body></html>`;
}

function renderText(args: {
  orgName: string;
  cycleName: string;
  report: RiskReport;
  link: string;
}): string {
  const { report, orgName, cycleName, link } = args;
  const risks = report.risks
    .map(
      (r, i) =>
        `${i + 1}. ${r.kr_or_objective}\n   ${r.why}\n   -> ${r.suggested_action}`,
    )
    .join("\n\n");
  const wins = report.wins.length > 0 ? `\n\nWins:\n- ${report.wins.join("\n- ")}` : "";
  const watch =
    report.watch_next_week.length > 0
      ? `\n\nWatch next week:\n- ${report.watch_next_week.join("\n- ")}`
      : "";
  return `Weekly risk digest — ${orgName} · ${cycleName}

${report.headline}

${risks || "No material risks this week."}${wins}${watch}

Open dashboard: ${link}
`;
}
