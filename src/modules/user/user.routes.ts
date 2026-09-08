import { Router } from "express";
import { UserController } from "@/modules/user/user.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { updateProfileSchema, myBookingHistoryQuerySchema } from "@/modules/user/user.validator";
import addressRoutes from "@/modules/address/address.routes";

const router = Router();
const controller = new UserController();

router.use(requireAuth);

router.get("/me", asyncHandler((req, res) => controller.getMe(req, res)));
router.patch("/me", validate({ body: updateProfileSchema }), asyncHandler((req, res) => controller.updateMe(req, res)));
router.get(
  "/me/bookings",
  validate({ query: myBookingHistoryQuerySchema }),
  asyncHandler((req, res) => controller.myBookings(req, res))
);

router.use("/me/addresses", addressRoutes);

export default router;
