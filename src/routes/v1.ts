import { Router } from "express";
import authRoutes from "@/modules/auth/auth.routes";
import userRoutes from "@/modules/user/user.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);

// Additional module routers are mounted here as each module is implemented:
// router.use("/salons", salonRoutes);
// router.use("/branches", branchRoutes);
// ...

export default router;
