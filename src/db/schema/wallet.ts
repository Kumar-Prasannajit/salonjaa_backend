import { pgTable, uuid, doublePrecision, text, timestamp, index } from "drizzle-orm/pg-core";
import { walletTransactionTypeEnum, walletTransactionReasonEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";

// Module 20 — a general customer wallet, co-defined with the user this session per
// docs/NEXT_SESSION_PLAN.md item 4. Not in the TRD (§2's BRD-exclusion list originally named
// "wallet" as explicitly out of scope — updated alongside this migration, see TRD.md).
// One row per user, find-or-create on first credit/debit (same precedent as
// salon_owner_profiles' first-salon-creation find-or-create) rather than provisioned at signup.
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  balance: doublePrecision("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only ledger — every balance change is recorded here, never just overwritten on
// `wallets.balance` alone (same "history is retained" philosophy as booking_status_history/
// refund_history). `referenceId` is a single generic nullable column (no per-entity FK split),
// same precedent as complaints.referenceId — it points at a booking (BOOKING_PAYMENT/
// BOOKING_REFUND) or a refund (REFUND_APPROVED) depending on `reason`, or is null
// (ADVANCE_FORFEITURE points at the booking whose advance was forfeited).
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    type: walletTransactionTypeEnum("type").notNull(),
    amount: doublePrecision("amount").notNull(),
    balanceAfter: doublePrecision("balance_after").notNull(),
    reason: walletTransactionReasonEnum("reason").notNull(),
    referenceId: uuid("reference_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    walletCreatedIdx: index("wallet_transactions_wallet_created_idx").on(table.walletId, table.createdAt),
  })
);
