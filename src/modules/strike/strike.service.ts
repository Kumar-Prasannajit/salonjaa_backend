import { StrikeRepository } from "@/modules/strike/strike.repository";
import { ADVANCE_PAYMENT_PERCENT, ADVANCE_PAYMENT_STRIKE_THRESHOLD } from "@/shared/constants";

/**
 * Core strike logic shared by Booking (records NO_SHOW strikes, checks the advance-payment
 * gate at creation time) and Admin (manual add/remove — see admin-strike.*, which has its own
 * repository per the established admin-module precedent but calls back into this service for
 * the actual restriction check).
 */
export class StrikeService {
  constructor(private readonly repo: StrikeRepository = new StrikeRepository()) {}

  /** True once a customer has ADVANCE_PAYMENT_STRIKE_THRESHOLD or more live NO_SHOW strikes. */
  async isAdvancePaymentRequired(customerId: string): Promise<boolean> {
    const count = await this.repo.countActive(customerId, "NO_SHOW");
    return count >= ADVANCE_PAYMENT_STRIKE_THRESHOLD;
  }

  /** 10% of the booking's total, rounded to 2 decimals — frozen onto the booking at creation. */
  computeAdvanceAmount(totalAmount: number): number {
    return Math.round(totalAmount * ADVANCE_PAYMENT_PERCENT * 100) / 100;
  }

  /** Called when a Salon Owner marks a booking NO_SHOW — see BookingService.markNoShow. */
  async recordNoShow(customerId: string, bookingId: string): Promise<void> {
    await this.repo.create({ customerId, bookingId, type: "NO_SHOW", notes: "Auto-recorded: booking marked no-show" });
  }
}
