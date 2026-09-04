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

// Additional module routers are mounted here as each module is implemented:
// ...

export default router;
