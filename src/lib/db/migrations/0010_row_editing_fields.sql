ALTER TABLE "key_results" ADD COLUMN "progress_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "manual_pace_status" text;