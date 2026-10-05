CREATE TABLE IF NOT EXISTS "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"type" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_employee_id_idx" ON "documents" USING btree ("employee_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_emp_date_unique_idx" ON "attendance" ("employee_id", "date");
