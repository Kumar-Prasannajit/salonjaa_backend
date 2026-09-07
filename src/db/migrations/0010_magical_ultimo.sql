ALTER TYPE "booking_status" ADD VALUE 'AWAITING_PAYMENT';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_method" "payment_method" DEFAULT 'ONLINE' NOT NULL;