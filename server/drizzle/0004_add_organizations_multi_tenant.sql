CREATE TABLE IF NOT EXISTS "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"domain" varchar(255),
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE set null;
--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "slug", "domain")
VALUES (1, 'Collabee HQ', 'collabee-hq', 'collabee.com')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "users" SET "organization_id" = 1 WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "departments" SET "organization_id" = 1 WHERE "organization_id" IS NULL;
