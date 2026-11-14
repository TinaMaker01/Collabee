-- Phase 5, step 1 of the multi-tenant isolation rollout: lock
-- organization_id down to NOT NULL now that phase 3 (every insert
-- stamps it) and phase 4 (every read is scoped by it) are deployed.
--
-- Guard first: abort the whole migration if any row anywhere still has
-- a NULL organization_id, rather than silently truncating data under a
-- NOT NULL constraint failure partway through.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "departments" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "employees" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "tasks" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "leave_requests" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "attendance" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "documents" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "onboarding_tasks" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "activity_logs" WHERE "organization_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "notifications" WHERE "organization_id" IS NULL)
  THEN
    RAISE EXCEPTION 'Aborting: at least one tenant-owned table still has rows with a NULL organization_id. Re-run the phase 2/3 backfill before applying this migration.';
  END IF;
END $$;
--> statement-breakpoint

-- Note for large production tables: for a table with significant row
-- counts, prefer the staged pattern (ADD CONSTRAINT ... CHECK (...)
-- NOT VALID; VALIDATE CONSTRAINT; then SET NOT NULL, which becomes a
-- fast metadata-only change) to avoid holding an ACCESS EXCLUSIVE lock
-- for the full-table scan. These tables are small in this deployment,
-- so a direct SET NOT NULL is applied here.
ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint

-- Phase 5, step 2: once organization_id is NOT NULL, ON DELETE SET NULL
-- on users/departments is impossible to honor (the FK action would
-- need to leave a null in a now-NOT-NULL column). Switch to RESTRICT,
-- the honest statement of intent: deleting an organization that still
-- has users or departments must be an explicit, deliberate operation
-- (cascade or soft-delete), never an implicit side effect.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_organization_id_fkey";
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
