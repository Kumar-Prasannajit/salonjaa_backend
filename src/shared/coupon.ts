import { UnprocessableEntityError } from "@/shared/errors";

/** The subset of a `coupons` row needed for eligibility/discount math — kept minimal so
 * callers can pass either a full Drizzle row or a partial object without extra mapping. */
export interface CouponLike {
  type: "FIXED" | "PERCENTAGE";
  value: number;
  minimumAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Shared coupon eligibility + discount math, extracted so `PaymentService.validateCoupon`
 * (Module 7, preview-only) and `BookingService.create`'s coupon attach (Module 12, the first
 * real attach point) can't drift into two different definitions of "valid" or "how much
 * discount." Throws UnprocessableEntityError (422) on any ineligibility, matching Module 7's
 * original behavior exactly.
 */
export function assertCouponEligible(coupon: CouponLike, bookingAmount: number): void {
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new UnprocessableEntityError("Coupon is not active yet");
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new UnprocessableEntityError("Coupon has expired");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new UnprocessableEntityError("Coupon usage limit reached");
  }
  if (coupon.minimumAmount !== null && bookingAmount < coupon.minimumAmount) {
    throw new UnprocessableEntityError(`Minimum booking amount of ${coupon.minimumAmount} required for this coupon`);
  }
}

/** Rounded to 2 decimal places, capped at maxDiscount (if set) and never more than the amount itself. */
export function computeCouponDiscount(coupon: Pick<CouponLike, "type" | "value" | "maxDiscount">, amount: number): number {
  let discount = coupon.type === "FIXED" ? coupon.value : (amount * coupon.value) / 100;
  if (coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  discount = Math.min(discount, amount);
  return Math.round(discount * 100) / 100;
}
