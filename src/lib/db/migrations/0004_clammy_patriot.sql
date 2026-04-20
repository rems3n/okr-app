CREATE TABLE "integrations_connected" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"nango_connection_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_by_user_id" uuid NOT NULL,
	"last_synced_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"integration_connected_id" uuid NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"config_schema" jsonb NOT NULL,
	"nango_sync_name" text NOT NULL,
	"output_unit" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "metric_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_result_id" uuid NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations_connected" ADD CONSTRAINT "integrations_connected_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations_connected" ADD CONSTRAINT "integrations_connected_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_bindings" ADD CONSTRAINT "metric_bindings_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_bindings" ADD CONSTRAINT "metric_bindings_integration_connected_id_integrations_connected_id_fk" FOREIGN KEY ("integration_connected_id") REFERENCES "public"."integrations_connected"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_bindings" ADD CONSTRAINT "metric_bindings_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_bindings" ADD CONSTRAINT "metric_bindings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_org_provider" ON "integrations_connected" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_nango_connection" ON "integrations_connected" USING btree ("nango_connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_binding_per_kr" ON "metric_bindings" USING btree ("key_result_id");--> statement-breakpoint
CREATE INDEX "idx_metric_values_kr" ON "metric_values" USING btree ("key_result_id","captured_at");