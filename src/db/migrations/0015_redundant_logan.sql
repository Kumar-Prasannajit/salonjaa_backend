DO $$ BEGIN
 CREATE TYPE "public"."gender_served" AS ENUM('UNISEX', 'MEN', 'WOMEN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "gender_served" "gender_served" DEFAULT 'UNISEX' NOT NULL;