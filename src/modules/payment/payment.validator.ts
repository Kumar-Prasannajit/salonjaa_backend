import { z } from "zod";

export const createOrderSchema = z.object({
  bookingId: z.string().uuid("Invalid booking id"),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().trim().min(1, "orderId is required"),
  paymentId: z.string().trim().min(1, "paymentId is required"),
  signature: z.string().trim().min(1, "signature is required"),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid("Invalid payment id"),
});

// Not marked "required" in frontend_handover.md — optional, same treatment as other
// unmarked reason fields (e.g. POST /bookings/:id/cancel).
export const refundRequestSchema = z.object({
  bookingId: z.string().uuid("Invalid booking id"),
  reason: z.string().trim().max(500).optional(),
});

export const validateCouponSchema = z.object({
  couponCode: z.string().trim().min(1, "couponCode is required").max(50),
  bookingAmount: z.number().positive("bookingAmount must be > 0"),
});
