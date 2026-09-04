import { AdminReportRepository } from "@/modules/admin/admin-report.repository";
import { ReportOverviewDTO } from "@/modules/admin/admin-report.types";

const DEFAULT_RANGE_DAYS = 30;

/**
 * Deliberately minimal (docs/ADMIN_CONTRACT.md §3) — plain aggregate COUNT/SUM queries, no
 * charts, no time-series, no export.
 *
 * The `from`/`to` range only applies to "flow" metrics (things that happened in a window:
 * bookings created, revenue collected). "Stock" metrics (current queue depths: salon
 * verification counts, open complaints, pending refunds) are always a live snapshot,
 * independent of the date range — an admin asking "how many complaints are open right now"
 * wants the current count, not "opened within this window." Documented here and in
 * PROGRESS.md since the contract's flat JSON example doesn't distinguish the two by itself.
 */
export class AdminReportService {
  constructor(private readonly repo: AdminReportRepository = new AdminReportRepository()) {}

  async getOverview(fromStr?: string, toStr?: string): Promise<ReportOverviewDTO> {
    const to = toStr ? new Date(`${toStr}T23:59:59.999`) : new Date();
    const from = fromStr ? new Date(`${fromStr}T00:00:00.000`) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    const [bookingCounts, totalRevenue, salonCounts, openComplaints, pendingRefunds] = await Promise.all([
      this.repo.countBookingsInRange(from, to),
      this.repo.sumRevenueInRange(from, to),
      this.repo.countSalonsByVerification(),
      this.repo.countOpenComplaints(),
      this.repo.countPendingRefunds(),
    ]);

    const totalBookings = bookingCounts.reduce((sum, r) => sum + r.count, 0);
    const completedBookings = bookingCounts.find((r) => r.status === "COMPLETED")?.count ?? 0;
    const cancelledBookings = bookingCounts.find((r) => r.status === "CANCELLED")?.count ?? 0;

    const totalSalons = salonCounts.reduce((sum, r) => sum + r.count, 0);
    const verifiedSalons = salonCounts.find((r) => r.status === "VERIFIED")?.count ?? 0;
    const pendingSalons = salonCounts.find((r) => r.status === "PENDING")?.count ?? 0;

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalSalons,
      verifiedSalons,
      pendingSalons,
      totalRevenue,
      openComplaints,
      pendingRefunds,
    };
  }
}
