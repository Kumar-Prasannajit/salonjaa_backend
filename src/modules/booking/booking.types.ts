// Module 22 — docs/NEXT_SESSION_PLAN.md item 1. A bare string stays valid (no variant — the
// service either has none, or the caller means "book the base service" for one with none).
// A duplicate entry (same serviceId AND same variantId) still means quantity > 1 for that
// exact line, same semantics as the old bare-string-array shape. This is the one part of the
// existing contract that changes shape, flagged in docs/frontend_handover.md's variants
// section per CLAUDE.md's "flag contract changes clearly" note in NEXT_SESSION_PLAN.md.
export type BookingServiceEntry = string | { serviceId: string; variantId?: string };

export interface CreateBookingInput {
  salonId: string;
  branchId: string;
  services: BookingServiceEntry[];
  staffId?: string;
  bookingDate: string; // YYYY-MM-DD
  slotId: string; // "HH:MM-HH:MM"
  notes?: string;
  // Module 12 — see docs/PROGRESS.md's "coupon can never attach to a booking" note. Validated
  // and, if eligible, snapshotted into bookings.discountAmount at creation time; invalid/
  // expired/exhausted/below-minimum codes throw 422 (same as POST /payments/coupons/validate)
  // rather than silently creating an undiscounted booking.
  couponCode?: string;
  // Module 14b — see PROGRESS.md's Module 14b entry. Defaults to ONLINE (the only path that
  // existed before this module) when omitted. Module 20 adds WALLET — spends the customer's
  // wallet balance in full at creation time (422 if insufficient, no booking created); never
  // needs the strikes-policy advance deposit, same reasoning as ONLINE (see BookingService.create).
  paymentMethod?: "ONLINE" | "PAY_AT_SALON" | "WALLET";
}

export interface CancelBookingInput {
  reasonCode?: "NEED_HELP" | "TOOK_TOO_LONG_TO_CONFIRM" | "BOOKED_BY_MISTAKE" | "BOOKED_ELSEWHERE" | "OTHER";
  reason?: string;
}

export interface RescheduleRequestInput {
  bookingDate: string;
  slotId: string;
  reason?: string;
}

export interface RejectRescheduleInput {
  reason?: string;
}

export interface ApproveBookingInput {
  notes?: string;
}

export interface RejectBookingInput {
  reason: string;
}

export interface ProposeRescheduleInput {
  bookingDate: string;
  slotId: string;
  reason?: string;
}

export interface WalkInInput {
  customerName: string;
  customerPhone: string;
  services: BookingServiceEntry[];
  staffId: string;
  bookingDate: string;
  slotId: string;
}

export interface BookingServiceLine {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  price: number;
  quantity: number;
  totalAmount: number;
  // Module 22 — null when the line has no variant (service has none, or none was selected
  // because none exist to select).
  variantId: string | null;
  variantName: string | null;
}

export interface BookingDTO {
  id: string;
  bookingNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  salonId: string;
  branchId: string;
  bookingType: string;
  bookingStatus: string;
  paymentMethod: string;
  selectedStaffId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  totalDurationMinutes: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  cancellationReasonCode: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  noShowAt: string | null;
  requiresAdvancePayment: boolean;
  advanceAmount: number | null;
  createdAt: string;
  services?: BookingServiceLine[];
  // Resolved server-side at query time — see docs/PROGRESS.md's "booking responses have no
  // resolved names" note. salonId/branchId/selectedStaffId above are unchanged (still raw
  // UUIDs); these are purely additive so nothing that already reads this DTO breaks.
  salonName: string | null;
  branchName: string | null;
  city: string | null;
  staffName: string | null;
  // Closes docs/COMPETITOR_COMPARISON_LUZO.md's "Call Salon" gap.
  branchPhone: string | null;
}

/** Denormalized names resolved for one booking, keyed by bookingId when resolving in bulk. */
export interface BookingNames {
  salonName: string | null;
  branchName: string | null;
  city: string | null;
  staffName: string | null;
  branchPhone: string | null;
}

export interface RescheduleRequestDTO {
  id: string;
  bookingId: string;
  requestedBy: string;
  oldScheduledStart: string;
  oldScheduledEnd: string;
  newScheduledStart: string;
  newScheduledEnd: string;
  reason: string | null;
  status: string;
}
