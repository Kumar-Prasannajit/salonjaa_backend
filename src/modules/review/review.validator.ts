import { z } from "zod";

const rating = z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5");

export const createReviewSchema = z.object({
  bookingId: z.string().uuid("Invalid booking id"),
  overallRating: rating,
  review: z.string().trim().max(2000).optional(),
  serviceRating: rating,
  staffRating: rating,
  hygieneRating: rating,
  ambienceRating: rating,
  productRating: rating,
});

export const updateReviewSchema = z.object({
  overallRating: rating.optional(),
  review: z.string().trim().max(2000).optional(),
  serviceRating: rating.optional(),
  staffRating: rating.optional(),
  hygieneRating: rating.optional(),
  ambienceRating: rating.optional(),
  productRating: rating.optional(),
});

export const reviewIdParamSchema = z.object({
  reviewId: z.string().uuid("Invalid review id"),
});

export const salonIdParamSchema = z.object({
  salonId: z.string().uuid("Invalid salon id"),
});

export const serviceIdParamSchema = z.object({
  serviceId: z.string().uuid("Invalid service id"),
});

export const staffIdParamSchema = z.object({
  staffId: z.string().uuid("Invalid staff id"),
});

// Not marked "required" in frontend_handover.md — optional, same treatment as other
// unmarked reason fields elsewhere in this codebase.
export const reportReviewSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const replyReviewSchema = z.object({
  message: z.string().trim().min(1, "message is required").max(1000),
});
