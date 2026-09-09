CREATE TABLE IF NOT EXISTS "service_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_service_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" double precision NOT NULL,
	"status" "service_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "booking_services" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_services" ADD COLUMN "variant_name" varchar(200);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_branch_service_id_branch_services_id_fk" FOREIGN KEY ("branch_service_id") REFERENCES "public"."branch_services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_variants_service_status_deleted_idx" ON "service_variants" USING btree ("branch_service_id","status","deleted_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_variant_id_service_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."service_variants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
