import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const c = getClient();
  if (!c) {
    console.warn(
      `[email] Skipping send to ${opts.to} — RESEND_API_KEY not set.`,
    );
    return { skipped: true as const };
  }
  const from =
    process.env.EMAIL_FROM ??
    "OKR App <onboarding@resend.dev>";
  const res = await c.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return res;
}
