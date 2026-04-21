ALTER TABLE "organizations" ADD COLUMN "company_size" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "industry" text;--> statement-breakpoint
-- Existing orgs with a cycle are already onboarded; don't push them through
-- the new wizard.
UPDATE "organizations" SET "onboarding_completed" = true
WHERE "onboarding_completed" = false
  AND EXISTS (SELECT 1 FROM "cycles" WHERE "cycles"."organization_id" = "organizations"."id");