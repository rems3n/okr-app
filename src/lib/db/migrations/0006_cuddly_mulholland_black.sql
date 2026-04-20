CREATE TABLE "key_result_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"score" numeric(3, 2) NOT NULL,
	"final_value" numeric(18, 4) NOT NULL,
	"reflection" text NOT NULL,
	"scored_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "key_result_scores" ADD CONSTRAINT "key_result_scores_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_result_scores" ADD CONSTRAINT "key_result_scores_scored_by_user_id_users_id_fk" FOREIGN KEY ("scored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_score_per_kr" ON "key_result_scores" USING btree ("key_result_id");