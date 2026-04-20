import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { processNangoSync } from "@/inngest/process-nango-sync";
import { sendCheckInReminder } from "@/inngest/send-check-in-reminder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendCheckInReminder, processNangoSync],
});
