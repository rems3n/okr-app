import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  cycles,
  keyResults,
  objectives,
  organizations,
  users,
} from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { inngest } from "@/lib/inngest/client";
import { scopedDb } from "@/lib/db/scoped";

const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://okr-app-production-46c5.up.railway.app";

/**
 * Every Monday at 09:00 UTC, nudges each owner of an unchecked KR (in an
 * active cycle) to run the check-in flow. Sent via Resend.
 */
export const sendCheckInReminder = inngest.createFunction(
  {
    id: "send-check-in-reminder",
    triggers: [{ cron: "0 9 * * 1" }],
  },
  async ({ step, logger }) => {
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
        if (!activeCycle) return;

        const ownerRows = await db
          .selectDistinct({ ownerUserId: keyResults.ownerUserId })
          .from(keyResults)
          .innerJoin(objectives, eq(objectives.id, keyResults.objectiveId))
          .where(
            and(
              eq(objectives.organizationId, org.id),
              eq(objectives.cycleId, activeCycle.id),
              isNull(keyResults.deletedAt),
              isNull(objectives.deletedAt),
            ),
          );

        const scoped = scopedDb(org.id);
        for (const { ownerUserId } of ownerRows) {
          const pending = await scoped.listKrsNeedingCheckIn(
            ownerUserId,
            activeCycle.id,
          );
          if (pending.length === 0) continue;
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, ownerUserId))
            .limit(1);
          if (!user?.email) continue;
          const link = `${APP_URL()}/check-in`;
          await sendEmail({
            to: user.email,
            subject: `Time to update your OKRs — ${pending.length} ${pending.length === 1 ? "KR" : "KRs"} waiting`,
            text: `Hi ${user.name},\n\nYou have ${pending.length} KR${pending.length === 1 ? "" : "s"} in ${activeCycle.name} that need a weekly check-in.\n\nOpen the check-in flow: ${link}\n\n— OKR App`,
            html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111"><p>Hi ${escape(user.name)},</p><p>You have <b>${pending.length} KR${pending.length === 1 ? "" : "s"}</b> in <b>${escape(activeCycle.name)}</b> that need a weekly check-in.</p><p><a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Update your KRs</a></p><p style="color:#666;font-size:12px">— OKR App</p></body></html>`,
          });
          logger.info(
            `Reminder sent to ${user.email} (${pending.length} pending)`,
          );
        }
      });
    }
  },
);

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
