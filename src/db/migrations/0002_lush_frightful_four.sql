CREATE TABLE IF NOT EXISTS "salon_owner_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(200),
	"gst_number" varchar(20),
	"pan_number" varchar(20),
	"kyc_status" "kyc_status" DEFAULT 'PENDING' NOT NULL,
	"status" "salon_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_profile_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"logo" text,
	"cover_image" text,
	"status" "salon_status" DEFAULT 'ACTIVE' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"verification_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branch_capacity_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"max_capacity_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branch_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"holiday_date" date NOT NULL,
	"reason" varchar(255),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"total_chairs" integer NOT NULL,
	"opening_time" time NOT NULL,
	"closing_time" time NOT NULL,
	"status" "branch_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salon_owner_profiles" ADD CONSTRAINT "salon_owner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salons" ADD CONSTRAINT "salons_owner_profile_id_salon_owner_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."salon_owner_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "branch_capacity_rules" ADD CONSTRAINT "branch_capacity_rules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "branch_holidays" ADD CONSTRAINT "branch_holidays_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "branch_holidays" ADD CONSTRAINT "branch_holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "branches" ADD CONSTRAINT "branches_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salon_owner_profiles_active_user_unique" ON "salon_owner_profiles" USING btree ("user_id") WHERE "salon_owner_profiles"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salon_owner_profiles_gst_unique" ON "salon_owner_profiles" USING btree ("gst_number") WHERE "salon_owner_profiles"."gst_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salon_owner_profiles_pan_unique" ON "salon_owner_profiles" USING btree ("pan_number") WHERE "salon_owner_profiles"."pan_number" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "salon_owner_profiles_kyc_status_idx" ON "salon_owner_profiles" USING btree ("kyc_status","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "salons_status_verification_deleted_idx" ON "salons" USING btree ("status","verification_status","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "salons_owner_profile_id_idx" ON "salons" USING btree ("owner_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branch_capacity_rules_branch_unique" ON "branch_capacity_rules" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branch_holidays_branch_date_unique" ON "branch_holidays" USING btree ("branch_id","holiday_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branch_holidays_branch_date_idx" ON "branch_holidays" USING btree ("branch_id","holiday_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_salon_status_deleted_idx" ON "branches" USING btree ("salon_id","status","deleted_at");