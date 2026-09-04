export interface ReportOverviewDTO {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSalons: number;
  verifiedSalons: number;
  pendingSalons: number;
  totalRevenue: number;
  openComplaints: number;
  pendingRefunds: number;
}
