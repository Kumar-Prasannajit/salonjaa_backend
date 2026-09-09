import { WalletRepository } from "@/modules/wallet/wallet.repository";
import { WalletDTO, WalletTransactionDTO } from "@/modules/wallet/wallet.types";
import { wallets, walletTransactions } from "@/db/schema";

type WalletTransactionRow = typeof walletTransactions.$inferSelect;
type WalletRow = typeof wallets.$inferSelect;

/**
 * Module 20 — general customer wallet, co-defined with the user per
 * docs/NEXT_SESSION_PLAN.md item 4. Scoped deliberately narrow for this first pass (confirmed
 * with the user rather than assumed): funded only by admin-approved refunds and Module 16
 * forfeitures, spendable as a `paymentMethod: "WALLET"` option on booking creation, no
 * withdrawal, no expiry. A customer with no wallet activity yet has no `wallets` row at all —
 * find-or-create happens on first credit/debit (see WalletRepository), so `getBalance` reports
 * 0 rather than creating a row just to read it.
 */
export class WalletService {
  constructor(private readonly repo: WalletRepository = new WalletRepository()) {}

  async getBalance(userId: string): Promise<WalletDTO> {
    const wallet = await this.repo.findByUserId(userId);
    return { balance: wallet?.balance ?? 0 };
  }

  async listTransactions(userId: string): Promise<WalletTransactionDTO[]> {
    const rows = await this.repo.listTransactions(userId);
    return rows.map((r) => this.toDTO(r));
  }

  /**
   * NOTE: the actual wallet DEBIT at booking-creation time does NOT go through this service —
   * it's written directly inside BookingRepository.createBookingTransactional, in the SAME
   * transaction as the booking insert (deliberate: WalletRepository.debit opens its own
   * transaction, which can't be made atomic with the booking row it must roll back alongside on
   * failure). Same "own repository, don't share a transaction across module boundaries"
   * precedent as BookingRepository's coupon writes not going through PaymentRepository. This
   * service is for every OTHER wallet mutation, which happens as an independent, later write —
   * same pattern as `issueForfeitureCoupon`'s (now `creditForfeiture`'s) post-transition call.
   */

  /** A WALLET-paid booking was cancelled, rejected, or expired — refund the spend back in full. */
  async refundBookingPayment(userId: string, amount: number, bookingId: string, bookingNumber: string): Promise<WalletRow> {
    return this.repo.credit(userId, amount, "BOOKING_REFUND", bookingId, `Refund for booking ${bookingNumber}`);
  }

  /** An admin approved a refund — credits the wallet instead of the old "just marks approved, no money moves" behavior. */
  async creditRefundApproval(userId: string, amount: number, refundId: string, bookingNumber: string): Promise<WalletRow> {
    return this.repo.credit(userId, amount, "REFUND_APPROVED", refundId, `Refund approved for booking ${bookingNumber}`);
  }

  /**
   * Replaces Module 16's forfeiture-coupon mechanism: a strikes-policy advance deposit
   * forfeited on cancellation is credited to the wallet instead of minting a single-use coupon.
   */
  async creditForfeiture(userId: string, amount: number, bookingId: string, bookingNumber: string): Promise<WalletRow> {
    return this.repo.credit(userId, amount, "ADVANCE_FORFEITURE", bookingId, `Advance forfeited for booking ${bookingNumber}`);
  }

  private toDTO(row: WalletTransactionRow): WalletTransactionDTO {
    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      reason: row.reason,
      referenceId: row.referenceId,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
