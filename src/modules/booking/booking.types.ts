export interface CreateBookingInput {
  salonId: string;
  branchId: string;
  services: string[]; // service IDs; duplicates mean quantity > 1 for that service
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
  // existed before this module) when omitted.
  paymentMethod?: "ONLINE" | "PAY_AT_SALON";
}

export interface CancelBookingInput {
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
  services: string[];
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
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  services?: BookingServiceLine[];
  // Resolved server-side at query time — see docs/PROGRESS.md's "booking responses have no
  // resolved names" note. salonId/branchId/selectedStaffId above are unchanged (still raw
  // UUIDs); these are purely additive so nothing that already reads this DTO breaks.
  salonName: string | null;
  branchName: string | null;
  city: string | null;
  staffName: string | null;
}

/** Denormalized names resolved for one booking, keyed by bookingId when resolving in bulk. */
export interface BookingNames {
  salonName: string | null;
  branchName: string | null;
  city: string | null;
  staffName: string | null;
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
