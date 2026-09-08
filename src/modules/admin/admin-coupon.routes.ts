import { Router } from "express";
import { AdminCouponController } from "@/modules/admin/admin-coupon.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { couponIdParamSchema, createCouponSchema, updateCouponSchema } from "@/modules/admin/admin-coupon.validator";
import { ROLE_NAMES } from "@/shared/constants";

// Module 16 — new contract (ADMIN_CONTRACT.md explicitly excluded coupon management).
const router = Router();
const controller = new AdminCouponController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.post("/", validate({ body: createCouponSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.patch(
  "/:id",
  validate({ params: couponIdParamSchema, body: updateCouponSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete("/:id", validate({ params: couponIdParamSchema }), asyncHandler((req, res) => controller.remove(req, res)));

export default router;
