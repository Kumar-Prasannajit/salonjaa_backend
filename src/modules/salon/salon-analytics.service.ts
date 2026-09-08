import { SalonAnalyticsRepository } from "@/modules/salon/salon-analytics.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { SalonAnalyticsDTO } from "@/modules/salon/salon-analytics.types";

const DEFAULT_RANGE_DAYS = 30;

/**
 * Module 16 — new contract (owner-facing analytics, beyond Admin's reports-overview which is
 * platform-wide). Same "deliberately minimal, plain aggregates, no charts" philosophy as
 * AdminReportService — this is that same pattern scoped to one salon the caller owns.
 */
export class SalonAnalyticsService {
  constructor(
    private readonly repo: SalonAnalyticsRepository = new SalonAnalyticsRepository(),
    private readonly salonService: SalonService = new SalonService()
  ) {}

  async getOverview(userId: string, salonId: string, fromStr?: string, toStr?: string): Promise<SalonAnalyticsDTO> {
    await this.salonService.assertOwned(userId, salonId);

    const to = toStr ? new Date(`${toStr}T23:59:59.999`) : new Date();
    const from = fromStr ? new Date(`${fromStr}T00:00:00.000`) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    const [bookingCounts, totalRevenue, rating, topServices] = await Promise.all([
      this.repo.countBookingsInRange(salonId, from, to),
      this.repo.sumRevenueInRange(salonId, from, to),
      this.repo.getRatingAggregate(salonId),
      this.repo.topServicesInRange(salonId, from, to),
    ]);

    const totalBookings = bookingCounts.reduce((sum, r) => sum + r.count, 0);
    const completedBookings = bookingCounts.find((r) => r.status === "COMPLETED")?.count ?? 0;
    const cancelledBookings = bookingCounts.find((r) => r.status === "CANCELLED")?.count ?? 0;
    const noShowBookings = bookingCounts.find((r) => r.status === "NO_SHOW")?.count ?? 0;

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      totalRevenue,
      averageRating: rating.average,
      reviewCount: rating.count,
      topServices,
    };
  }
}
