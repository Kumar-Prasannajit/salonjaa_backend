import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "bookingDate must be YYYY-MM-DD")
  .refine((val) => !Number.isNaN(Date.parse(val)), "bookingDate must be a valid date")
  .refine((val) => new Date(val).getTime() >= Date.now() - 24 * 60 * 60 * 1000, "bookingDate must not be in the past");

const slotIdSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/, "Invalid slotId");

// Module 22 — a bare uuid string (no variant) OR {serviceId, variantId?}. See
// BookingServiceEntry in booking.types.ts for the full rationale.
const serviceEntrySchema = z.union([
  z.string().uuid("Invalid service id"),
  z.object({
    serviceId: z.string().uuid("Invalid service id"),
    variantId: z.string().uuid("Invalid variant id").optional(),
  }),
]);

export const createBookingSchema = z.object({
  salonId: z.string().uuid("Invalid salon id"),
  branchId: z.string().uuid("Invalid branch id"),
  services: z.array(serviceEntrySchema).min(1, "At least one service is required"),
  staffId: z.string().uuid("Invalid staff id").optional(),
  bookingDate: dateSchema,
  slotId: slotIdSchema,
  notes: z.string().trim().max(1000).optional(),
  couponCode: z.string().trim().min(1, "couponCode cannot be empty").max(50).optional(),
  // Module 14b — defaults to ONLINE (service-layer default) when omitted. Module 20 adds WALLET.
  paymentMethod: z.enum(["ONLINE", "PAY_AT_SALON", "WALLET"]).optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid("Invalid booking id"),
});

// Closes docs/COMPETITOR_COMPARISON_LUZO.md's structured-cancellation-reason gap. reasonCode
// is optional (not yet required — frontend doesn't have the picker UI built yet) so existing
// freeform-only callers keep working unchanged; once the UI ships this can become required.
export const cancelBookingSchema = z.object({
  reasonCode: z.enum(["NEED_HELP", "TOOK_TOO_LONG_TO_CONFIRM", "BOOKED_BY_MISTAKE", "BOOKED_ELSEWHERE", "OTHER"]).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleRequestSchema = z.object({
  bookingDate: dateSchema,
  slotId: slotIdSchema,
  reason: z.string().trim().max(500).optional(),
});

// Not marked "required" in frontend_handover.md for this specific endpoint (unlike
// POST /salon-bookings/:id/reject, which explicitly says "reason required") — optional here.
export const rejectRescheduleSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const approveBookingSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const rejectBookingSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});

export const proposeRescheduleSchema = z.object({
  bookingDate: dateSchema,
  slotId: slotIdSchema,
  reason: z.string().trim().max(500).optional(),
});

// staffId is effectively required here (decided with the user) — it's the only field in the
// documented walk-in body that can resolve which branch the walk-in belongs to.
export const walkInSchema = z.object({
  customerName: z.string().trim().min(1, "customerName is required").max(200),
  customerPhone: z.string().trim().min(1, "customerPhone is required").max(20),
  services: z.array(serviceEntrySchema).min(1, "At least one service is required"),
  staffId: z.string().uuid("Invalid staff id"),
  bookingDate: dateSchema,
  slotId: slotIdSchema,
});

const myBookingsStatusEnum = z.enum(["PENDING", "AWAITING_PAYMENT", "APPROVED", "CANCELLED", "COMPLETED"]);

export const myBookingsQuerySchema = z.object({
  status: myBookingsStatusEnum.optional(),
});

export const salonBookingsQuerySchema = z.object({
  status: myBookingsStatusEnum.optional(),
});
