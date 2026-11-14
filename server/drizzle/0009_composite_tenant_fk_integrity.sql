-- Phase 5, step 3 of the multi-tenant isolation rollout: DB-level
-- defense in depth against a row whose organization_id disagrees with
-- the organization_id of a row it references (e.g. a task assigned to
-- an employee in a different organization). Phase 4's app-level
-- assertXInTenant() checks already prevent this on every write path;
-- this adds the same guarantee at the schema level so it holds even
-- against a bug in application code, a future code path that forgets
-- the check, or a direct DB write.
--
-- Verified against the local dev database before writing this
-- migration: zero existing rows disagree on organization_id with any
-- row they reference (employees/users/departments), so this is safe
-- to apply without a backfill.

-- Composite unique anchors required before a composite FK can target
-- (id, organization_id) on these tables.
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_id_organization_id_unique" UNIQUE ("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_id_organization_id_unique" UNIQUE ("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_id_organization_id_unique" UNIQUE ("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- Child rows pointing at an employee must agree on organization_id.
-- A NULL in either column of a composite FK (MATCH SIMPLE, the
-- default) exempts the row from the check, which is exactly what we
-- want for nullable columns like tasks.assigned_to.
DO $$ BEGIN
  ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_org_fk" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_org_fk" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approver_org_fk" FOREIGN KEY ("approved_by", "organization_id") REFERENCES "users"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_org_fk" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Matches the existing single-column onboarding_tasks.employeeFk, which
-- is ON DELETE CASCADE: both FKs fire on an employee delete, so both
-- must agree or the composite one (default NO ACTION) would block a
-- delete the single-column one would otherwise allow.
DO $$ BEGIN
  ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_employee_org_fk" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- tasks: three independent FKs (assignee, creator, department) that
-- could previously diverge in organization with nothing to stop it.
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_org_fk" FOREIGN KEY ("assigned_to", "organization_id") REFERENCES "employees"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_org_fk" FOREIGN KEY ("created_by", "organization_id") REFERENCES "users"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_org_fk" FOREIGN KEY ("department_id", "organization_id") REFERENCES "departments"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- employees.departmentId and departments.managerId: the two remaining
-- cross-entity references that could previously diverge in org.
-- departments.manager_id had no FK at all before this migration.
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_department_org_fk" FOREIGN KEY ("department_id", "organization_id") REFERENCES "departments"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_org_fk" FOREIGN KEY ("manager_id", "organization_id") REFERENCES "users"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_org_fk" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_org_fk" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
