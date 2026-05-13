CREATE TYPE "public"."blood_type" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'intersex', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."condition_category" AS ENUM('cardiovascular', 'endocrine', 'renal', 'neurological', 'musculoskeletal', 'mental_health', 'oncology', 'hematological', 'dermatological', 'gastrointestinal', 'respiratory', 'autoimmune', 'other');--> statement-breakpoint
CREATE TYPE "public"."condition_change_field" AS ENUM('status', 'severity', 'managing_doctor', 'notes');--> statement-breakpoint
CREATE TYPE "public"."condition_severity" AS ENUM('mild', 'moderate', 'severe', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."condition_status" AS ENUM('active', 'controlled', 'in_remission', 'resolved', 'suspected');--> statement-breakpoint
CREATE TYPE "public"."medication_category" AS ENUM('allopathic', 'ayurvedic', 'homeopathic', 'supplement', 'OTC', 'other');--> statement-breakpoint
CREATE TYPE "public"."medication_change_field" AS ENUM('dose', 'frequency', 'status', 'prescribing_doctor');--> statement-breakpoint
CREATE TYPE "public"."medication_form" AS ENUM('tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'patch', 'drops', 'other');--> statement-breakpoint
CREATE TYPE "public"."medication_status" AS ENUM('active', 'paused', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."allergy_category" AS ENUM('drug', 'food', 'environmental', 'other');--> statement-breakpoint
CREATE TYPE "public"."allergy_severity" AS ENUM('mild', 'moderate', 'severe', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."allergy_status" AS ENUM('active', 'resolved', 'suspected', 'disproved');--> statement-breakpoint
CREATE TYPE "public"."lifestyle_alcohol_use" AS ENUM('never', 'occasional', 'regular', 'former');--> statement-breakpoint
CREATE TYPE "public"."lifestyle_exercise_intensity" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."lifestyle_stress_level" AS ENUM('low', 'moderate', 'high', 'variable');--> statement-breakpoint
CREATE TYPE "public"."lifestyle_tobacco_use" AS ENUM('never', 'former', 'current');--> statement-breakpoint
CREATE TYPE "public"."family_history_relation" AS ENUM('parent', 'sibling', 'child', 'grandparent', 'aunt_uncle', 'cousin', 'other');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('routine_followup', 'new_consultation', 'urgent', 'specialist_referral', 'second_opinion', 'telemedicine', 'hospitalization', 'surgery', 'other');--> statement-breakpoint
CREATE TYPE "public"."lab_result_flag" AS ENUM('normal', 'low', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."vital_context" AS ENUM('fasting', 'post_meal', 'morning', 'evening', 'pre_medication', 'post_medication', 'other');--> statement-breakpoint
CREATE TYPE "public"."vital_flag" AS ENUM('normal', 'low', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."vital_reading_type" AS ENUM('blood_pressure', 'weight', 'blood_glucose', 'temperature', 'heart_rate', 'oxygen_saturation', 'respiratory_rate', 'other');--> statement-breakpoint
CREATE TYPE "public"."symptom_body_area" AS ENUM('head', 'chest', 'abdomen', 'back', 'arms', 'legs', 'skin', 'general', 'other');--> statement-breakpoint
CREATE TYPE "public"."symptom_episode_severity" AS ENUM('mild', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."symptom_status" AS ENUM('active', 'resolved', 'monitoring');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('extracting', 'ready', 'failed', 'committed');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('discharge_summary', 'doctor_letter', 'prescription', 'insurance', 'imaging', 'other');--> statement-breakpoint
CREATE TYPE "public"."journal_mood" AS ENUM('concerned', 'neutral', 'hopeful', 'frustrated', 'other');--> statement-breakpoint
CREATE TYPE "public"."insight_category" AS ENUM('pattern', 'risk', 'gap', 'interaction', 'trend', 'improvement');--> statement-breakpoint
CREATE TYPE "public"."insight_severity" AS ENUM('informational', 'watch', 'attention', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('new', 'seen', 'acknowledged', 'dismissed', 'acted_on');--> statement-breakpoint
CREATE TYPE "public"."extraction_session_status" AS ENUM('pending', 'ready_for_confirmation', 'failed', 'committed');--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" date NOT NULL,
	"sex" "sex" NOT NULL,
	"blood_type" "blood_type",
	"height_cm" numeric,
	"current_weight_kg" numeric,
	"country" text NOT NULL,
	"city" text,
	"timezone" text NOT NULL,
	"family_history" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"clinic" text,
	"phone" text,
	"email" text,
	"address" text,
	"first_visit" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"condition_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" "condition_change_field" NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "condition_category",
	"icd_code" text,
	"status" "condition_status" DEFAULT 'active' NOT NULL,
	"severity" "condition_severity",
	"diagnosed_on" date,
	"diagnosed_by" uuid,
	"managing_doctor" uuid,
	"notes" text,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" "medication_change_field" NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"recorded_by" uuid,
	"linked_visit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand_name" text,
	"form" "medication_form",
	"current_dose" text NOT NULL,
	"current_frequency" text NOT NULL,
	"purpose" uuid,
	"prescribing_doctor" uuid,
	"category" "medication_category" NOT NULL,
	"started_on" date,
	"status" "medication_status" DEFAULT 'active' NOT NULL,
	"discontinued_on" date,
	"discontinuation_reason" text,
	"notes" text,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"substance" text NOT NULL,
	"category" "allergy_category" NOT NULL,
	"reaction" text,
	"severity" "allergy_severity" DEFAULT 'unknown',
	"first_noted" date,
	"confirmed_by" uuid,
	"status" "allergy_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allergy_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allergy_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifestyle_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifestyle_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"diet_pattern" text,
	"diet_restrictions" text[],
	"exercise_pattern" text,
	"exercise_intensity" "lifestyle_exercise_intensity",
	"sleep_pattern" text,
	"stress_level" "lifestyle_stress_level",
	"stress_context" text,
	"tobacco_use" "lifestyle_tobacco_use",
	"alcohol_use" "lifestyle_alcohol_use",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"relation" "family_history_relation" NOT NULL,
	"relation_specific" text,
	"condition_name" text NOT NULL,
	"age_of_onset" integer,
	"outcome" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"visit_date" date NOT NULL,
	"visit_type" "visit_type",
	"chief_complaint" text,
	"summary" text,
	"diagnosis_text" text,
	"next_steps" text,
	"status" "visit_status" DEFAULT 'completed' NOT NULL,
	"notes" text,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"report_type" text,
	"lab_name" text,
	"ordered_by" uuid,
	"linked_visit_id" uuid,
	"source_file_url" text,
	"summary" text,
	"notes" text,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_report_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"marker" text NOT NULL,
	"marker_normalized" text,
	"value" numeric,
	"value_text" text,
	"unit" text,
	"reference_low" numeric,
	"reference_high" numeric,
	"flag" "lab_result_flag",
	"result_date" date NOT NULL,
	"linked_condition" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vital_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"reading_type" "vital_reading_type" NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"value_primary" numeric,
	"value_secondary" numeric,
	"unit" text NOT NULL,
	"context" "vital_context",
	"flag" "vital_flag",
	"linked_symptom_id" uuid,
	"notes" text,
	"recorded_by" uuid,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symptom_type_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer,
	"severity" "symptom_episode_severity",
	"description" text,
	"triggers" text,
	"relief" text,
	"linked_vital_ids" uuid[],
	"linked_visit_id" uuid,
	"notes" text,
	"recorded_by" uuid,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body_area" "symptom_body_area",
	"linked_condition" uuid,
	"first_noted" date,
	"status" "symptom_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"report_type" "report_type",
	"report_date" date NOT NULL,
	"source_file_url" text,
	"content" text,
	"linked_visit_id" uuid,
	"linked_doctor_id" uuid,
	"notes" text,
	"recorded_by" uuid,
	"status" "report_status" DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"linked_entities" jsonb,
	"mood" "journal_mood",
	"recorded_by" uuid,
	"source_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" "insight_category" NOT NULL,
	"severity" "insight_severity" NOT NULL,
	"triggered_by" jsonb NOT NULL,
	"cited_sources" jsonb NOT NULL,
	"external_refs" jsonb,
	"linked_entities" jsonb,
	"status" "insight_status" DEFAULT 'new' NOT NULL,
	"dismissed_reason" text,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"status" "extraction_session_status" DEFAULT 'pending' NOT NULL,
	"extraction_output_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_changes" ADD CONSTRAINT "doctor_changes_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_changes" ADD CONSTRAINT "condition_changes_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_diagnosed_by_doctors_id_fk" FOREIGN KEY ("diagnosed_by") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_managing_doctor_doctors_id_fk" FOREIGN KEY ("managing_doctor") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_changes" ADD CONSTRAINT "medication_changes_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_changes" ADD CONSTRAINT "medication_changes_linked_visit_id_visits_id_fk" FOREIGN KEY ("linked_visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_purpose_conditions_id_fk" FOREIGN KEY ("purpose") REFERENCES "public"."conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_prescribing_doctor_doctors_id_fk" FOREIGN KEY ("prescribing_doctor") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_confirmed_by_doctors_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergy_changes" ADD CONSTRAINT "allergy_changes_allergy_id_allergies_id_fk" FOREIGN KEY ("allergy_id") REFERENCES "public"."allergies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifestyle_changes" ADD CONSTRAINT "lifestyle_changes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifestyle_profiles" ADD CONSTRAINT "lifestyle_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_history" ADD CONSTRAINT "family_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_ordered_by_doctors_id_fk" FOREIGN KEY ("ordered_by") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_linked_visit_id_visits_id_fk" FOREIGN KEY ("linked_visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_lab_report_id_lab_reports_id_fk" FOREIGN KEY ("lab_report_id") REFERENCES "public"."lab_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_linked_condition_conditions_id_fk" FOREIGN KEY ("linked_condition") REFERENCES "public"."conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_linked_symptom_id_symptom_episodes_id_fk" FOREIGN KEY ("linked_symptom_id") REFERENCES "public"."symptom_episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_episodes" ADD CONSTRAINT "symptom_episodes_symptom_type_id_symptom_types_id_fk" FOREIGN KEY ("symptom_type_id") REFERENCES "public"."symptom_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_episodes" ADD CONSTRAINT "symptom_episodes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_episodes" ADD CONSTRAINT "symptom_episodes_linked_visit_id_visits_id_fk" FOREIGN KEY ("linked_visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_episodes" ADD CONSTRAINT "symptom_episodes_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_types" ADD CONSTRAINT "symptom_types_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_types" ADD CONSTRAINT "symptom_types_linked_condition_conditions_id_fk" FOREIGN KEY ("linked_condition") REFERENCES "public"."conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_linked_visit_id_visits_id_fk" FOREIGN KEY ("linked_visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_linked_doctor_id_doctors_id_fk" FOREIGN KEY ("linked_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_sessions" ADD CONSTRAINT "extraction_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_sessions" ADD CONSTRAINT "extraction_sessions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doctor_changes_doctor_idx" ON "doctor_changes" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "condition_changes_condition_idx" ON "condition_changes" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "conditions_patient_status_idx" ON "conditions" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "medication_changes_medication_idx" ON "medication_changes" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "medications_patient_status_idx" ON "medications" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "allergy_changes_allergy_idx" ON "allergy_changes" USING btree ("allergy_id");--> statement-breakpoint
CREATE INDEX "lifestyle_changes_patient_idx" ON "lifestyle_changes" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifestyle_profiles_patient_unique_idx" ON "lifestyle_profiles" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "visits_patient_date_idx" ON "visits" USING btree ("patient_id","visit_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lab_reports_patient_date_idx" ON "lab_reports" USING btree ("patient_id","report_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lab_results_patient_marker_date_idx" ON "lab_results" USING btree ("patient_id","marker_normalized","result_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lab_results_report_idx" ON "lab_results" USING btree ("lab_report_id");--> statement-breakpoint
CREATE INDEX "vital_readings_patient_recorded_idx" ON "vital_readings" USING btree ("patient_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vital_readings_type_recorded_idx" ON "vital_readings" USING btree ("reading_type","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "symptom_episodes_patient_started_idx" ON "symptom_episodes" USING btree ("patient_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "symptom_episodes_type_started_idx" ON "symptom_episodes" USING btree ("symptom_type_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_patient_idx" ON "reports" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "journal_entries_patient_idx" ON "journal_entries" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "insights_patient_status_generated_idx" ON "insights" USING btree ("patient_id","status","generated_at" DESC NULLS LAST);