-- Fix organizations.id sequence: migration 0004 inserted an explicit id=1 row,
-- which left the serial sequence at its initial value. The next plain INSERT
-- (e.g. a future signup flow) would collide on the primary key.
SELECT setval(
  pg_get_serial_sequence('organizations', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM "organizations"), 1)
);
--> statement-breakpoint
-- Re-run the backfill idempotently in case rows were added to users/departments
-- after migration 0004 ran (e.g. between deploys) without an organization_id.
UPDATE "users"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "departments"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'collabee-hq')
WHERE "organization_id" IS NULL;
