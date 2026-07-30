CREATE TYPE "public"."onboarding_phase" AS ENUM('patient', 'conditions', 'medications', 'doctors', 'allergies', 'family_history', 'lifestyle', 'loose_ends', 'complete');--> statement-breakpoint
CREATE TYPE "public"."onboarding_session_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "onboarding_session_status" DEFAULT 'active' NOT NULL,
	"current_phase" "onboarding_phase" DEFAULT 'patient' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_sessions_patient_unique_idx" ON "onboarding_sessions" USING btree ("patient_id");