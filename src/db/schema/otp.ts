import { pgTable, uuid, varchar, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { otpPurposeEnum, otpStatusEnum } from "@/db/schema/enums";

export const emailOtps = pgTable(
  "email_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    otpHash: varchar("otp_hash", { length: 128 }).notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    status: otpStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lookupIdx: index("email_otps_lookup_idx").on(table.email, table.purpose, table.status, table.expiresAt),
    // Only one ACTIVE OTP per (email, purpose) at a time.
    oneActivePerEmailPurpose: uniqueIndex("email_otps_one_active_unique")
      .on(table.email, table.purpose)
      .where(sql`${table.status} = 'ACTIVE'`),
  })
);
