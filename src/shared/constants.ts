export const ROLE_NAMES = {
  CUSTOMER: "CUSTOMER",
  SALON_OWNER: "SALON_OWNER",
  ADMIN: "ADMIN",
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export const OTP_PURPOSES = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  BOOKING_CHECKIN: "BOOKING_CHECKIN",
} as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Availability (Module 5): branch_slot_templates has no CRUD endpoint anywhere in the docs
// (deferred in Module 3), so there's no per-branch way to configure slot granularity. Slots
// are generated at this fixed interval across the branch's opening->closing window instead.
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

// Module 16 — finalized cancellation/refund cutoff (was provisional/no-cutoff — see
// docs/context.md's old Pending Decisions entry, now resolved): free cancellation up to this
// many hours before scheduledStart; blocked entirely inside the window, no exceptions.
export const CANCELLATION_CUTOFF_HOURS = 2;

// Module 16 — customer strikes / advance-payment policy, decided with the user (not a TRD
// number): a customer's 4th lifetime NO_SHOW strike onward permanently requires an advance
// payment on every future booking, equal to this percentage of that booking's totalAmount.
// Counts only non-removed NO_SHOW strikes — an admin's REMOVE_STRIKE action lowering the live
// count below the threshold is the only way this ever un-triggers (no automatic "N clean
// bookings" decay — see docs/PROGRESS.md's Module 16 note).
export const ADVANCE_PAYMENT_STRIKE_THRESHOLD = 4;
export const ADVANCE_PAYMENT_PERCENT = 0.1;

// Booking statuses that reserve branch capacity (TRD context.md booking-engine decisions):
// "pending and approved bookings reserve availability; rejected, expired, cancelled,
// refunded, and completed bookings do not."
// Module 14b: AWAITING_PAYMENT also reserves capacity — the slot stays held for the
// customer during the payment window, same as it did while the status was APPROVED before
// this module existed.
export const CAPACITY_CONSUMING_BOOKING_STATUSES = ["PENDING", "APPROVED", "AWAITING_PAYMENT"] as const;
