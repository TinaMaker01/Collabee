-- Phase 5, step 4 of the multi-tenant isolation rollout: employee email
-- uniqueness scope changes from global to per-organization.
--
-- Product decision made explicit here (per the db review flagged during
-- planning): employees are scoped per organization, not shared as a
-- global identity across organizations. A person who works with two
-- different client organizations would need two separate employee
-- records (one per org), each with its own id. This matches the
-- existing shape of users.organizationId (a single, non-nullable FK),
-- which already committed to this model without anyone deciding it
-- explicitly.
--
-- Safe to apply now (not before): phase 4 scoped every employees.email
-- lookup by organizationId, so cross-tenant email collisions can no
-- longer be silently matched to the wrong tenant's employee.
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_email_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_organization_email_unique_idx" ON "employees" ("organization_id", "email");
