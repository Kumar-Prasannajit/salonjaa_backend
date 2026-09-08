DO $$ BEGIN
 CREATE TYPE "public"."payment_purpose" AS ENUM('FULL', 'ADVANCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"booking_id" uuid,
	"type" "strike_type" NOT NULL,
	"notes" text,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requires_advance_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "advance_amount" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "restricted_to_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "purpose" "payment_purpose" DEFAULT 'FULL' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_strikes" ADD CONSTRAINT "customer_strikes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_strikes" ADD CONSTRAINT "customer_strikes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_strikes" ADD CONSTRAINT "customer_strikes_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_strikes_customer_removed_idx" ON "customer_strikes" USING btree ("customer_id","removed_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coupons" ADD CONSTRAINT "coupons_restricted_to_customer_id_users_id_fk" FOREIGN KEY ("restricted_to_customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
