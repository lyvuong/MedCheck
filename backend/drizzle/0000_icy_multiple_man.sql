CREATE TYPE "public"."coverage_tier" AS ENUM('TIER_1_PREFERRED_GENERIC', 'TIER_2_GENERIC', 'TIER_3_PREFERRED_BRAND', 'TIER_4_NON_PREFERRED_DRUG', 'TIER_5_SPECIALTY', 'NOT_COVERED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."data_source_type" AS ENUM('MANUAL', 'CMS_PUF', 'WENO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'DOCTOR', 'STAFF');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "formulary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"tier" "coverage_tier" DEFAULT 'UNKNOWN' NOT NULL,
	"covered" boolean DEFAULT true NOT NULL,
	"prior_auth_required" boolean DEFAULT false NOT NULL,
	"step_therapy_required" boolean DEFAULT false NOT NULL,
	"quantity_limit" text,
	"estimated_copay_cents" integer,
	"estimated_coinsurance_pct" real,
	"notes" text,
	"data_source" "data_source_type" DEFAULT 'MANUAL' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insurance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payer_name" text NOT NULL,
	"plan_name" text NOT NULL,
	"plan_type" text,
	"contract_id" text,
	"plan_id" text,
	"segment_id" text,
	"plan_year" integer,
	"state" text,
	"data_source" "data_source_type" DEFAULT 'MANUAL' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lookup_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"medication_query" text NOT NULL,
	"plan_id" uuid,
	"result_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"generic_name" text,
	"ndc" text,
	"rxcui" text,
	"drug_class" text,
	"strength" text,
	"form" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medications_ndc_unique" UNIQUE("ndc")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"npi" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "formulary_entries" ADD CONSTRAINT "formulary_entries_plan_id_insurance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."insurance_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "formulary_entries" ADD CONSTRAINT "formulary_entries_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lookup_logs" ADD CONSTRAINT "lookup_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_plan_medication" ON "formulary_entries" USING btree ("plan_id","medication_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "formulary_medication_idx" ON "formulary_entries" USING btree ("medication_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_cms_plan_identity" ON "insurance_plans" USING btree ("contract_id","plan_id","segment_id","plan_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_payer_name_idx" ON "insurance_plans" USING btree ("payer_name","plan_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookup_user_created_idx" ON "lookup_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medication_name_idx" ON "medications" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medication_class_idx" ON "medications" USING btree ("drug_class");