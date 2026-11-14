-- Phase 2 of the multi-tenant isolation rollout: add organization_id to
-- every table that holds tenant-owned data, backfill it via the real
-- relational join (falling back to the default org only for genuinely
-- orphaned rows), and fix departments.name's uniqueness to be per-org
-- instead of global.
--
-- Columns are added nullable for now; NOT NULL lands in a later migration
-- once phase 3 (every insert stamps organizationId) is deployed and a
-- verification query confirms zero NULLs remain (see plan phase 5.1).

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "organization_id" integer REFERENCES "organizations"("id") ON DELETE RESTRICT;
--> statement-breakpoint

-- employees: from the department's org, else from a user sharing the same
-- email, else the default org.
UPDATE "employees" e
SET "organization_id" = COALESCE(
  (SELECT d."organization_id" FROM "departments" d WHERE d."id" = e."department_id"),
  (SELECT u."organization_id" FROM "users" u WHERE u."email" = e."email"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE e."organization_id" IS NULL;
--> statement-breakpoint

-- tasks: from the department's org, else the creator's org, else default.
UPDATE "tasks" t
SET "organization_id" = COALESCE(
  (SELECT d."organization_id" FROM "departments" d WHERE d."id" = t."department_id"),
  (SELECT u."organization_id" FROM "users" u WHERE u."id" = t."created_by"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE t."organization_id" IS NULL;
--> statement-breakpoint

-- leave_requests, attendance, documents, onboarding_tasks: from the
-- employee's org (now backfilled above), else default.
UPDATE "leave_requests" lr
SET "organization_id" = COALESCE(
  (SELECT e."organization_id" FROM "employees" e WHERE e."id" = lr."employee_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE lr."organization_id" IS NULL;
--> statement-breakpoint

UPDATE "attendance" a
SET "organization_id" = COALESCE(
  (SELECT e."organization_id" FROM "employees" e WHERE e."id" = a."employee_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE a."organization_id" IS NULL;
--> statement-breakpoint

UPDATE "documents" doc
SET "organization_id" = COALESCE(
  (SELECT e."organization_id" FROM "employees" e WHERE e."id" = doc."employee_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE doc."organization_id" IS NULL;
--> statement-breakpoint

UPDATE "onboarding_tasks" ot
SET "organization_id" = COALESCE(
  (SELECT e."organization_id" FROM "employees" e WHERE e."id" = ot."employee_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE ot."organization_id" IS NULL;
--> statement-breakpoint

-- activity_logs, notifications: from the user's org, else default.
UPDATE "activity_logs" al
SET "organization_id" = COALESCE(
  (SELECT u."organization_id" FROM "users" u WHERE u."id" = al."user_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE al."organization_id" IS NULL;
--> statement-breakpoint

UPDATE "notifications" n
SET "organization_id" = COALESCE(
  (SELECT u."organization_id" FROM "users" u WHERE u."id" = n."user_id"),
  (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
)
WHERE n."organization_id" IS NULL;
--> statement-breakpoint

-- departments.name uniqueness: global -> per-organization. Two different
-- organizations must be able to both have a department named "Engineering".
-- Dropping the constraint also drops its backing unique index.
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_name_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_organization_name_unique_idx" ON "departments" ("organization_id", "name");
--> statement-breakpoint

-- Indexes matched to each table's dominant query shape, plus two
-- pre-existing missing FK indexes noticed along the way.
CREATE INDEX IF NOT EXISTS "employees_organization_status_idx" ON "employees" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_organization_department_idx" ON "employees" ("organization_id", "department_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_organization_status_idx" ON "tasks" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_organization_due_date_idx" ON "tasks" ("organization_id", "due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_created_by_idx" ON "tasks" ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_organization_status_idx" ON "leave_requests" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_approved_by_idx" ON "leave_requests" ("approved_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_organization_date_idx" ON "attendance" ("organization_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_organization_user_read_idx" ON "notifications" ("organization_id", "user_id", "read");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_organization_created_at_idx" ON "activity_logs" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_organization_employee_idx" ON "documents" ("organization_id", "employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_tasks_organization_employee_idx" ON "onboarding_tasks" ("organization_id", "employee_id");
