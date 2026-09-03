import { pgTable, uuid, integer, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { reviewCategoryEnum, reviewReportStatusEnum } from "@/db/schema/enums";
import { bookings } from "@/db/schema/booking";
import { users } from "@/db/schema/identity";
import { salons } from "@/db/schema/salon";
import { branches } from "@/db/schema/branch";
import { staff } from "@/db/schema/staff";

// review_images (TRD §4) is intentionally NOT created — POST /reviews/:reviewId/images has no
// documented request contract anywhere in frontend_handover.md ("image upload contract not
// supplied"), and the user asked to skip that endpoint entirely for now rather than guess a
// format. Add the table when a contract exists.
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    overallRating: integer("overall_rating").notNull(),
    reviewText: text("review_text"),
    isEdited: boolean("is_edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    salonIdx: index("reviews_salon_id_idx").on(table.salonId),
    staffIdx: index("reviews_staff_id_idx").on(table.staffId),
    customerIdx: index("reviews_customer_id_idx").on(table.customerId),
  })
);

export const reviewCategoryRatings = pgTable(
  "review_category_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    category: reviewCategoryEnum("category").notNull(),
    rating: integer("rating").notNull(),
  },
  (table) => ({
    reviewCategoryUnique: uniqueIndex("review_category_ratings_review_category_unique").on(
      table.reviewId,
      table.category
    ),
  })
);

export const reviewResponses = pgTable(
  "review_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    respondedBy: uuid("responded_by").references(() => users.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reviewIdx: index("review_responses_review_id_idx").on(table.reviewId),
  })
);

export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    status: reviewReportStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reviewReporterUnique: uniqueIndex("review_reports_review_reporter_unique").on(table.reviewId, table.reportedBy),
    statusIdx: index("review_reports_status_idx").on(table.status),
  })
);
