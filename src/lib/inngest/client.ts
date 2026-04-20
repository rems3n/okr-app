import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "okr-app",
  // Inngest auto-discovers INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY from env.
});
