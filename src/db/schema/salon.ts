import { pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
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

// TRD §4 — deferred in Module 3 ("real future table, no documented endpoint yet"). Module 16
// gives it a real contract, co-defined with the user: reuses the exact same "URL string,
// frontend hosts the file elsewhere" precedent salons.logo/coverImage already established,
// not a new image-upload mechanism.
export const salonGalleryImages = pgTable(
  "salon_gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    // TRD: "unique (salon_id, display_order) among active images."
    activeOrderUnique: uniqueIndex("salon_gallery_images_active_order_unique")
      .on(table.salonId, table.displayOrder)
      .where(sql`${table.deletedAt} is null`),
  })
);
