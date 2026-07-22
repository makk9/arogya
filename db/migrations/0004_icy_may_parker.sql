CREATE TYPE "public"."insight_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "insight_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger" jsonb NOT NULL,
	"status" "insight_run_status" DEFAULT 'running' NOT NULL,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"model_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_runs" ADD CONSTRAINT "insight_runs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insight_runs_patient_started_idx" ON "insight_runs" USING btree ("patient_id","started_at" DESC NULLS LAST);