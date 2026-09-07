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

// Booking statuses that reserve branch capacity (TRD context.md booking-engine decisions):
// "pending and approved bookings reserve availability; rejected, expired, cancelled,
// refunded, and completed bookings do not."
// Module 14b: AWAITING_PAYMENT also reserves capacity — the slot stays held for the
// customer during the payment window, same as it did while the status was APPROVED before
// this module existed.
export const CAPACITY_CONSUMING_BOOKING_STATUSES = ["PENDING", "APPROVED", "AWAITING_PAYMENT"] as const;
