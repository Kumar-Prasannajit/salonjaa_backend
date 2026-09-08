import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { bookings, payments, reviews, bookingServices } from "@/db/schema";
import { StatusCount } from "@/modules/admin/admin-report.repository";

export class SalonAnalyticsRepository {
  /** Bookings created within [from, to] for this salon, by current status — same "flow"
   * framing as AdminReportRepository.countBookingsInRange, scoped to one salon. */
  async countBookingsInRange(salonId: string, from: Date, to: Date): Promise<StatusCount[]> {
    return db
      .select({ status: bookings.bookingStatus, count: sql<number>`count(*)`.mapWith(Number) })
      .from(bookings)
      .where(and(eq(bookings.salonId, salonId), gte(bookings.createdAt, from), lte(bookings.createdAt, to)))
      .groupBy(bookings.bookingStatus);
  }

  async sumRevenueInRange(salonId: string, from: Date, to: Date): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number) })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(and(eq(bookings.salonId, salonId), eq(payments.status, "SUCCESS"), gte(payments.paidAt, from), lte(payments.paidAt, to)));
    return row?.total ?? 0;
  }

  /** Current live aggregate — same "stock, not time-scoped" treatment as reviews everywhere else in this codebase. */
  async getRatingAggregate(salonId: string): Promise<{ average: number | null; count: number }> {
    const [row] = await db
      .select({
        average: sql<number | null>`avg(${reviews.overallRating})`.mapWith((v) => (v === null ? null : Number(v))),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviews)
      .where(eq(reviews.salonId, salonId));
    return { average: row?.average ?? null, count: row?.count ?? 0 };
  }

  /** Top 5 services by booking count within [from, to] for this salon. */
  async topServicesInRange(salonId: string, from: Date, to: Date): Promise<{ serviceId: string; serviceName: string; bookingCount: number }[]> {
    return db
      .select({
        serviceId: bookingServices.serviceId,
        serviceName: bookingServices.serviceName,
        bookingCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(bookingServices)
      .innerJoin(bookings, eq(bookingServices.bookingId, bookings.id))
      .where(and(eq(bookings.salonId, salonId), gte(bookings.createdAt, from), lte(bookings.createdAt, to)))
      .groupBy(bookingServices.serviceId, bookingServices.serviceName)
      .orderBy(sql`count(*) desc`)
      .limit(5);
  }
}
