import { ReviewRepository, ReviewCategory } from "@/modules/review/review.repository";
import { BookingRepository } from "@/modules/booking/booking.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { CreateReviewInput, ReviewDTO, UpdateReviewInput } from "@/modules/review/review.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { reviews, reviewCategoryRatings, reviewResponses } from "@/db/schema";

type ReviewRow = typeof reviews.$inferSelect;
type CategoryRatingRow = typeof reviewCategoryRatings.$inferSelect;
type ReplyRow = typeof reviewResponses.$inferSelect;

export class ReviewService {
  constructor(
    private readonly repo: ReviewRepository = new ReviewRepository(),
    private readonly bookingRepo: BookingRepository = new BookingRepository(),
    private readonly salonService: SalonService = new SalonService()
  ) {}

  async create(userId: string, input: CreateReviewInput): Promise<ReviewDTO> {
    const booking = await this.bookingRepo.findById(input.bookingId);
    if (!booking || booking.customerId !== userId) {
      throw new NotFoundError("Booking not found");
    }
    // Reachable now via the booking auto-completion job (Module 8) — see docs/PROGRESS.md.
    if (booking.bookingStatus !== "COMPLETED") {
      throw new ConflictError("Only a completed booking can be reviewed");
    }

    const existing = await this.repo.findByBookingId(input.bookingId);
    if (existing) {
      throw new ConflictError("A review already exists for this booking");
    }

    const review = await this.repo.create({
      bookingId: booking.id,
      customerId: userId,
      salonId: booking.salonId,
      branchId: booking.branchId,
      staffId: booking.selectedStaffId,
      overallRating: input.overallRating,
      reviewText: input.review ?? null,
      serviceRating: input.serviceRating,
      staffRating: input.staffRating,
      hygieneRating: input.hygieneRating,
      ambienceRating: input.ambienceRating,
      productRating: input.productRating,
    });

    const ratings = await this.repo.findCategoryRatings(review.id);
    return this.toDTO(review, ratings);
  }

  /**
   * PROVISIONAL: no edit-period cutoff enforced — the numeric review edit period is
   * unresolved (context.md Pending Decisions), same category and same placeholder treatment
   * already applied to booking cancellation and refund eligibility.
   */
  async update(userId: string, reviewId: string, input: UpdateReviewInput): Promise<ReviewDTO> {
    const review = await this.repo.findById(reviewId);
    if (!review || review.customerId !== userId) {
      throw new NotFoundError("Review not found");
    }

    const updated = await this.repo.update(reviewId, {
      overallRating: input.overallRating,
      reviewText: input.review,
    });

    const categoryUpdates: [ReviewCategory, number | undefined][] = [
      ["SERVICE", input.serviceRating],
      ["STAFF", input.staffRating],
      ["HYGIENE", input.hygieneRating],
      ["AMBIENCE", input.ambienceRating],
      ["PRODUCT", input.productRating],
    ];
    for (const [category, rating] of categoryUpdates) {
      if (rating !== undefined) {
        await this.repo.upsertCategoryRating(reviewId, category, rating);
      }
    }

    const ratings = await this.repo.findCategoryRatings(reviewId);
    return this.toDTO(updated, ratings);
  }

  async getDetail(reviewId: string): Promise<ReviewDTO> {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }
    const ratings = await this.repo.findCategoryRatings(reviewId);
    const replies = await this.repo.listReplies(reviewId);
    return this.toDTO(review, ratings, replies[0]);
  }

  async listBySalon(salonId: string): Promise<ReviewDTO[]> {
    const rows = await this.repo.listBySalon(salonId);
    return this.toDTOList(rows);
  }

  async listByStaff(staffId: string): Promise<ReviewDTO[]> {
    const rows = await this.repo.listByStaff(staffId);
    return this.toDTOList(rows);
  }

  async listByService(serviceId: string): Promise<ReviewDTO[]> {
    const rows = await this.repo.listByService(serviceId);
    return this.toDTOList(rows);
  }

  async report(userId: string, reviewId: string, reason?: string): Promise<void> {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }
    const existing = await this.repo.findReportByReviewAndReporter(reviewId, userId);
    if (existing) {
      throw new ConflictError("You have already reported this review");
    }
    await this.repo.createReport(reviewId, userId, reason);
  }

  async reply(userId: string, reviewId: string, message: string): Promise<ReviewDTO> {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new NotFoundError("Review not found");
    }
    await this.salonService.assertOwned(userId, review.salonId);

    await this.repo.createReply(reviewId, userId, message);
    return this.getDetail(reviewId);
  }

  private async toDTOList(rows: ReviewRow[]): Promise<ReviewDTO[]> {
    return Promise.all(
      rows.map(async (row) => {
        const ratings = await this.repo.findCategoryRatings(row.id);
        return this.toDTO(row, ratings);
      })
    );
  }

  private toDTO(review: ReviewRow, ratings: CategoryRatingRow[], reply?: ReplyRow): ReviewDTO {
    const byCategory = Object.fromEntries(ratings.map((r) => [r.category, r.rating]));
    return {
      id: review.id,
      bookingId: review.bookingId,
      customerId: review.customerId,
      salonId: review.salonId,
      branchId: review.branchId,
      staffId: review.staffId,
      overallRating: review.overallRating,
      review: review.reviewText,
      serviceRating: byCategory.SERVICE ?? null,
      staffRating: byCategory.STAFF ?? null,
      hygieneRating: byCategory.HYGIENE ?? null,
      ambienceRating: byCategory.AMBIENCE ?? null,
      productRating: byCategory.PRODUCT ?? null,
      isEdited: review.isEdited,
      createdAt: review.createdAt.toISOString(),
      reply: reply ? { message: reply.text, createdAt: reply.createdAt.toISOString() } : null,
    };
  }
}
