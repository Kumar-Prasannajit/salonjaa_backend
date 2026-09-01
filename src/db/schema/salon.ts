import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { kycStatusEnum, salonStatusEnum, verificationStatusEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";

export const salonOwnerProfiles = pgTable(
  "salon_owner_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    businessName: varchar("business_name", { length: 200 }),
    gstNumber: varchar("gst_number", { length: 20 }),
    panNumber: varchar("pan_number", { length: 20 }),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("PENDING"),
    status: salonStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    // One ACTIVE (non-deleted) owner profile per user.
    oneActivePerUser: uniqueIndex("salon_owner_profiles_active_user_unique")
      .on(table.userId)
      .where(sql`${table.deletedAt} is null`),
    gstUnique: uniqueIndex("salon_owner_profiles_gst_unique")
      .on(table.gstNumber)
      .where(sql`${table.gstNumber} is not null`),
    panUnique: uniqueIndex("salon_owner_profiles_pan_unique")
      .on(table.panNumber)
      .where(sql`${table.panNumber} is not null`),
    kycStatusIdx: index("salon_owner_profiles_kyc_status_idx").on(table.kycStatus, table.status),
  })
);

export const salons = pgTable(
  "salons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerProfileId: uuid("owner_profile_id")
      .notNull()
      .references(() => salonOwnerProfiles.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    logo: text("logo"),
    coverImage: text("cover_image"),
    status: salonStatusEnum("status").notNull().default("ACTIVE"),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("PENDING"),
    verificationReason: text("verification_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("salons_status_verification_deleted_idx").on(
      table.status,
      table.verificationStatus,
      table.deletedAt
    ),
    ownerProfileIdx: index("salons_owner_profile_id_idx").on(table.ownerProfileId),
  })
);
