import { pgEnum } from "drizzle-orm/pg-core";

// Identity
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const userGenderEnum = pgEnum("user_gender", ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);
export const roleTypeEnum = pgEnum("role_type", ["CUSTOMER", "SALON_OWNER", "ADMIN"]);
export const kycStatusEnum = pgEnum("kyc_status", ["PENDING", "APPROVED", "REJECTED"]);

// Salon / branch / staff / service
export const salonStatusEnum = pgEnum("salon_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const verificationStatusEnum = pgEnum("verification_status", ["PENDING", "VERIFIED", "REJECTED"]);
export const branchStatusEnum = pgEnum("branch_status", ["ACTIVE", "INACTIVE", "CLOSED"]);
export const staffTypeEnum = pgEnum("staff_type", ["NORMAL", "STAR"]);
export const staffStatusEnum = pgEnum("staff_status", ["ACTIVE", "INACTIVE"]);
export const leaveStatusEnum = pgEnum("leave_status", ["APPROVED", "CANCELLED"]);
export const serviceStatusEnum = pgEnum("service_status", ["ACTIVE", "INACTIVE"]);

// Booking
export const bookingTypeEnum = pgEnum("booking_type", ["ONLINE", "WALK_IN"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "COMPLETED",
  "REFUND_PENDING",
  "REFUNDED",
  "NO_SHOW",
  // Module 14b — not in the TRD's original enum list (§6). The client's "approve then
  // 15-minute payment window" rule (docs/PROGRESS.md's Module 6 note) had no state to
  // represent "approved, payment due, not yet paid" — see PROGRESS.md's Module 14b entry.
  "AWAITING_PAYMENT",
]);
export const rescheduleRequestStatusEnum = pgEnum("reschedule_request_status", ["PENDING", "ACCEPTED", "REJECTED"]);
export const requestedByEnum = pgEnum("requested_by", ["CUSTOMER", "SALON"]);
// Closes docs/COMPETITOR_COMPARISON_LUZO.md's "cancellation reason is freeform text, no
// analytics" gap — a structured code alongside the existing freeform `cancellationReason`
// (kept for "OTHER"/extra detail), same pattern as LUZO's fixed reason list.
export const bookingCancellationReasonEnum = pgEnum("booking_cancellation_reason", [
  "NEED_HELP",
  "TOOK_TOO_LONG_TO_CONFIRM",
  "BOOKED_BY_MISTAKE",
  "BOOKED_ELSEWHERE",
  "OTHER",
]);
export const strikeTypeEnum = pgEnum("strike_type", ["FAKE_BOOKING", "NO_SHOW", "ABUSIVE_CANCELLATION"]);

// Payment / coupon / settlement
// Module 20 — WALLET added. TRD §2's BRD-exclusion list originally named "wallet" as an
// out-of-scope future feature; the LUZO-comparison plan (docs/NEXT_SESSION_PLAN.md item 4)
// proposed building one anyway, decided with the user to build now and update the TRD's
// exclusion list rather than leave the docs contradicting the code — see TRD.md's edit.
export const paymentMethodEnum = pgEnum("payment_method", ["ONLINE", "PAY_AT_SALON", "WALLET"]);
// Module 16 — distinguishes a strikes-policy advance payment (10% of a restricted customer's
// booking, paid before the salon owner can approve it) from the normal full-amount payment.
export const paymentPurposeEnum = pgEnum("payment_purpose", ["FULL", "ADVANCE"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["NONE", "RAZORPAY", "CASHFREE"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);
export const refundStatusEnum = pgEnum("refund_status", ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]);
export const couponTypeEnum = pgEnum("coupon_type", ["FIXED", "PERCENTAGE"]);
export const settlementStatusEnum = pgEnum("settlement_status", ["PENDING", "PROCESSING", "COMPLETED"]);

// Notification / OTP
export const notificationTypeEnum = pgEnum("notification_type", ["EMAIL", "SMS", "WHATSAPP", "IN_APP"]);
export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED", "READ"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["LOGIN", "REGISTER", "VERIFY_EMAIL", "BOOKING_CHECKIN"]);
export const otpStatusEnum = pgEnum("otp_status", ["ACTIVE", "VERIFIED", "EXPIRED"]);

// Review / complaint / admin
export const reviewReportStatusEnum = pgEnum("review_report_status", ["PENDING", "APPROVED", "REJECTED"]);
// Not in the TRD's enum list (§6) — the documented POST /reviews body has five fixed rating
// fields (serviceRating, staffRating, hygieneRating, ambienceRating, productRating), which
// TRD §4's review_category_ratings table stores as generic (category, rating) rows. This
// enum is the minimal addition needed to give "category" a concrete value set matching that
// exact documented body.
export const reviewCategoryEnum = pgEnum("review_category", [
  "SERVICE",
  "STAFF",
  "HYGIENE",
  "AMBIENCE",
  "PRODUCT",
]);
export const complaintTypeEnum = pgEnum("complaint_type", ["BOOKING", "PAYMENT", "SALON", "STAFF", "REFUND", "OTHER"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]);
export const adminActionTypeEnum = pgEnum("admin_action_type", [
  "APPROVE",
  "REJECT",
  "SUSPEND",
  "REMOVE_STRIKE",
  "REFUND",
  "EDIT",
]);

// Wallet (Module 20 — see docs/PROGRESS.md and TRD.md's edited BRD-exclusion note).
export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", ["CREDIT", "DEBIT"]);
export const walletTransactionReasonEnum = pgEnum("wallet_transaction_reason", [
  // Customer spent wallet balance as POST /bookings' paymentMethod: "WALLET".
  "BOOKING_PAYMENT",
  // That spend refunded back because the booking was cancelled/rejected/expired afterward.
  "BOOKING_REFUND",
  // An admin-approved refund (POST /admin/refunds/:id/approve) now credits the wallet instead
  // of just marking the decision — see docs/PROGRESS.md's Module 20 note.
  "REFUND_APPROVED",
  // Replaces Module 16's forfeiture-coupon mechanism: a strikes-policy advance deposit
  // forfeited on cancellation is now credited to the wallet instead of minting a coupon.
  "ADVANCE_FORFEITURE",
]);
