import { Router } from "express";
import authRoutes from "@/modules/auth/auth.routes";
import userRoutes from "@/modules/user/user.routes";
import salonRoutes from "@/modules/salon/salon.routes";
import branchRoutes from "@/modules/branch/branch.routes";
import staffRoutes from "@/modules/staff/staff.routes";
import serviceRoutes from "@/modules/service/service.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/salons", salonRoutes);
router.use("/branches", branchRoutes);
router.use("/staff", staffRoutes);
router.use("/services", serviceRoutes);

// Additional module routers are mounted here as each module is implemented:
// ...

export default router;
