export interface SalonAnalyticsDTO {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  totalRevenue: number;
  averageRating: number | null;
  reviewCount: number;
  topServices: { serviceId: string; serviceName: string; bookingCount: number }[];
}
