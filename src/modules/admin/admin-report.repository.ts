import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { bookings, salons, payments, complaints, refunds } from "@/db/schema";

export interface StatusCount {
  status: string;
  count: number;
}

export class AdminReportRepository {
  /** Bookings created within [from, to], broken down by current status — a "flow" metric. */
  async countBookingsInRange(from: Date, to: Date): Promise<StatusCount[]> {
    return db
      .select({ status: bookings.bookingStatus, count: sql<number>`count(*)`.mapWith(Number) })
      .from(bookings)
      .where(and(gte(bookings.createdAt, from), lte(bookings.createdAt, to)))
      .groupBy(bookings.bookingStatus);
  }

  /** SUCCESS payments paid within [from, to] — a "flow" metric. */
  async sumRevenueInRange(from: Date, to: Date): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.status, "SUCCESS"), gte(payments.paidAt, from), lte(payments.paidAt, to)));
    return row?.total ?? 0;
  }

  /** Current queue snapshot, not time-scoped — "stock" metrics, same as openComplaints/pendingRefunds below. */
  async countSalonsByVerification(): Promise<StatusCount[]> {
    return db
      .select({ status: salons.verificationStatus, count: sql<number>`count(*)`.mapWith(Number) })
      .from(salons)
      .where(isNull(salons.deletedAt))
      .groupBy(salons.verificationStatus);
  }

  async countOpenComplaints(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(complaints)
      .where(eq(complaints.status, "OPEN"));
    return row?.count ?? 0;
  }

  async countPendingRefunds(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(refunds)
      .where(eq(refunds.status, "PENDING"));
    return row?.count ?? 0;
  }
}
