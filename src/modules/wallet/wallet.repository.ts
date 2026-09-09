import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { wallets, walletTransactions } from "@/db/schema";
import { UnprocessableEntityError } from "@/shared/errors";

type WalletTransactionReason = "BOOKING_PAYMENT" | "BOOKING_REFUND" | "REFUND_APPROVED" | "ADVANCE_FORFEITURE";

export class WalletRepository {
  async findByUserId(userId: string) {
    const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return row ?? null;
  }

  async listTransactions(userId: string) {
    const wallet = await this.findByUserId(userId);
    if (!wallet) return [];
    return db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt));
  }

  /**
   * Credits `amount` to a user's wallet, creating the wallet row (balance 0) if this is their
   * first-ever wallet activity — same find-or-create precedent as salon_owner_profiles' first
   * salon creation. Serialized per-user via `pg_advisory_xact_lock(hashtext(userId))`, the same
   * mechanism BookingRepository.createBookingTransactional uses per-branch — deliberately not
   * a Postgres row lock (`SELECT ... FOR UPDATE`), to stay consistent with the one concurrency
   * pattern already established and verified in this codebase.
   */
  async credit(userId: string, amount: number, reason: WalletTransactionReason, referenceId?: string, description?: string) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [existing] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      const wallet = existing ?? (await tx.insert(wallets).values({ userId, balance: 0 }).returning())[0];
      const balanceAfter = wallet.balance + amount;

      const [updated] = await tx
        .update(wallets)
        .set({ balance: balanceAfter, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id))
        .returning();

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "CREDIT",
        amount,
        balanceAfter,
        reason,
        referenceId: referenceId ?? null,
        description: description ?? null,
      });

      return updated;
    });
  }

  /**
   * Debits `amount` from a user's wallet, same locking/find-or-create shape as `credit` above.
   * Throws directly (not the service) when the balance is insufficient — an established
   * exception to "repositories never throw AppError" for checks that can only be made safely
   * under the same lock as the write itself, same precedent as
   * BookingRepository.createBookingTransactional's capacity/staff-conflict checks.
   */
  async debit(userId: string, amount: number, reason: WalletTransactionReason, referenceId?: string, description?: string) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [existing] = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      const wallet = existing ?? (await tx.insert(wallets).values({ userId, balance: 0 }).returning())[0];
      if (wallet.balance < amount) {
        throw new UnprocessableEntityError("Insufficient wallet balance");
      }
      const balanceAfter = wallet.balance - amount;

      const [updated] = await tx
        .update(wallets)
        .set({ balance: balanceAfter, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id))
        .returning();

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "DEBIT",
        amount,
        balanceAfter,
        reason,
        referenceId: referenceId ?? null,
        description: description ?? null,
      });

      return updated;
    });
  }
}
