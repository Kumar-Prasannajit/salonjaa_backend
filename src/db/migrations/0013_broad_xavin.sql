DO $$ BEGIN
 CREATE TYPE "public"."booking_cancellation_reason" AS ENUM('NEED_HELP', 'TOOK_TOO_LONG_TO_CONFIRM', 'BOOKED_BY_MISTAKE', 'BOOKED_ELSEWHERE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason_code" "booking_cancellation_reason";