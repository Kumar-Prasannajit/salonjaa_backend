import { Router } from "express";
import authRoutes from "@/modules/auth/auth.routes";
import userRoutes from "@/modules/user/user.routes";
import salonRoutes from "@/modules/salon/salon.routes";
import branchRoutes from "@/modules/branch/branch.routes";
import staffRoutes from "@/modules/staff/staff.routes";
import serviceRoutes from "@/modules/service/service.routes";
import availabilityRoutes from "@/modules/availability/availability.routes";
import bookingRoutes from "@/modules/booking/booking.routes";
import salonBookingRoutes from "@/modules/booking/salon-booking.routes";
import paymentRoutes from "@/modules/payment/payment.routes";
import reviewRoutes from "@/modules/review/review.routes";
import adminRoutes from "@/modules/admin/admin.routes";
import adminRefundRoutes from "@/modules/admin/admin-refund.routes";
import adminComplaintRoutes from "@/modules/admin/admin-complaint.routes";
import complaintRoutes from "@/modules/complaint/complaint.routes";
import adminReportRoutes from "@/modules/admin/admin-report.routes";
import publicBranchRoutes from "@/modules/browse/public-branch.routes";
import serviceCategoryRoutes from "@/modules/browse/service-category.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/salons", salonRoutes);
router.use("/branches", branchRoutes);
router.use("/staff", staffRoutes);
router.use("/services", serviceRoutes);
router.use("/availability", availabilityRoutes);
router.use("/bookings", bookingRoutes);
router.use("/salon-bookings", salonBookingRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", adminRoutes);
router.use("/admin/refunds", adminRefundRoutes);
router.use("/admin/complaints", adminComplaintRoutes);
router.use("/complaints", complaintRoutes);
router.use("/admin/reports", adminReportRoutes);
router.use("/public/branches", publicBranchRoutes);
router.use("/service-categories", serviceCategoryRoutes);

// Additional module routers are mounted here as each module is implemented:
// ...

export default router;
