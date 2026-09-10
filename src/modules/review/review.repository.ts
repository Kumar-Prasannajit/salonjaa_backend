import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { reviews, reviewCategoryRatings, reviewResponses, reviewReports, bookings, bookingServices } from "@/db/schema";

interface CreateReviewParams {
  bookingId: string;
  customerId: string | null;
  salonId: string;
  branchId: string;
  staffId: string | null;
  overallRating: number;
  reviewText: string | null;
  serviceRating: number;
  staffRating: number;
  hygieneRating: number;
  ambienceRating: number;
  productRating: number;
}

export type ReviewCategory = "SERVICE" | "STAFF" | "HYGIENE" | "AMBIENCE" | "PRODUCT";

export class ReviewRepository {
  async findByBookingId(bookingId: string) {
    const [row] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.bookingId, bookingId), isNull(reviews.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findById(reviewId: string) {
    const [row] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), isNull(reviews.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async create(params: CreateReviewParams) {
    return db.transaction(async (tx) => {
      const [review] = await tx
        .insert(reviews)
        .values({
          bookingId: params.bookingId,
          customerId: params.customerId,
          salonId: params.salonId,
          branchId: params.branchId,
          staffId: params.staffId,
          overallRating: params.overallRating,
          reviewText: params.reviewText,
        })
        .returning();

      await tx.insert(reviewCategoryRatings).values([
        { reviewId: review.id, category: "SERVICE", rating: params.serviceRating },
        { reviewId: review.id, category: "STAFF", rating: params.staffRating },
        { reviewId: review.id, category: "HYGIENE", rating: params.hygieneRating },
        { reviewId: review.id, category: "AMBIENCE", rating: params.ambienceRating },
        { reviewId: review.id, category: "PRODUCT", rating: params.productRating },
      ]);

      return review;
    });
  }

  async findCategoryRatings(reviewId: string) {
    return db.select().from(reviewCategoryRatings).where(eq(reviewCategoryRatings.reviewId, reviewId));
  }

  async update(reviewId: string, fields: { overallRating?: number; reviewText?: string }) {
    const [row] = await db
      .update(reviews)
      .set({ ...fields, isEdited: true, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId))
      .returning();
    return row;
  }

  async upsertCategoryRating(reviewId: string, category: ReviewCategory, rating: number) {
    const [existing] = await db
      .select({ id: reviewCategoryRatings.id })
      .from(reviewCategoryRatings)
      .where(and(eq(reviewCategoryRatings.reviewId, reviewId), eq(reviewCategoryRatings.category, category)))
      .limit(1);

    if (existing) {
      await db.update(reviewCategoryRatings).set({ rating }).where(eq(reviewCategoryRatings.id, existing.id));
    } else {
      await db.insert(reviewCategoryRatings).values({ reviewId, category, rating });
    }
  }

  async listBySalon(salonId: string) {
    return db
      .select()
      .from(reviews)
      .where(and(eq(reviews.salonId, salonId), isNull(reviews.deletedAt)))
      .orderBy(desc(reviews.createdAt));
  }

  async listByStaff(staffId: string) {
    return db
      .select()
      .from(reviews)
      .where(and(eq(reviews.staffId, staffId), isNull(reviews.deletedAt)))
      .orderBy(desc(reviews.createdAt));
  }

  /** reviews has no direct serviceId column — derived via the booking's line items. */
  async listByService(serviceId: string) {
    const rows = await db
      .selectDistinct({ review: reviews })
      .from(reviews)
      .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
      .innerJoin(bookingServices, eq(bookingServices.bookingId, bookings.id))
      .where(and(eq(bookingServices.serviceId, serviceId), isNull(reviews.deletedAt)))
      .orderBy(desc(reviews.createdAt));
    return rows.map((r) => r.review);
  }

  // ---- Responses (owner replies) ----

  async listReplies(reviewId: string) {
    return db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, reviewId))
      .orderBy(desc(reviewResponses.createdAt));
  }

  /**
   * Bulk counterpart to listReplies() for list endpoints (listBySalon/listByStaff/
   * listByService) — one query keyed by reviewId instead of N+1, same pattern as
   * BookingRepository.findNamesForBookings. Only the latest reply per review is kept (rows
   * arrive newest-first), matching getDetail()'s replies[0] behavior.
   */
  async listRepliesForReviews(reviewIds: string[]) {
    const map = new Map<string, typeof reviewResponses.$inferSelect>();
    if (reviewIds.length === 0) return map;
    const rows = await db
      .select()
      .from(reviewResponses)
      .where(inArray(reviewResponses.reviewId, reviewIds))
      .orderBy(desc(reviewResponses.createdAt));
    for (const row of rows) {
      if (!map.has(row.reviewId)) map.set(row.reviewId, row);
    }
    return map;
  }

  async createReply(reviewId: string, respondedBy: string, text: string) {
    const [row] = await db.insert(reviewResponses).values({ reviewId, respondedBy, text }).returning();
    return row;
  }

  // ---- Reports ----

  async findReportByReviewAndReporter(reviewId: string, reportedBy: string) {
    const [row] = await db
      .select()
      .from(reviewReports)
      .where(and(eq(reviewReports.reviewId, reviewId), eq(reviewReports.reportedBy, reportedBy)))
      .limit(1);
    return row ?? null;
  }

  async createReport(reviewId: string, reportedBy: string, reason?: string) {
    const [row] = await db.insert(reviewReports).values({ reviewId, reportedBy, reason }).returning();
    return row;
  }
}
