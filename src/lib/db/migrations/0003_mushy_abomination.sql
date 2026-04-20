CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"previous_value" numeric(18, 4) NOT NULL,
	"new_value" numeric(18, 4) NOT NULL,
	"confidence" text NOT NULL,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_checkins_kr" ON "check_ins" USING btree ("key_result_id","created_at");