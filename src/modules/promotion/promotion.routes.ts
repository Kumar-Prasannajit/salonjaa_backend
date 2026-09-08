import { Router } from "express";
import { PromotionController } from "@/modules/promotion/promotion.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { promotionIdParamSchema, createPromotionSchema, updatePromotionSchema } from "@/modules/promotion/promotion.validator";
import { ROLE_NAMES } from "@/shared/constants";

// Module 16 — new contract (TRD §4's promotions, deferred since Module 10).
const router = Router();
const controller = new PromotionController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createPromotionSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.patch(
  "/:id",
  validate({ params: promotionIdParamSchema, body: updatePromotionSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete("/:id", validate({ params: promotionIdParamSchema }), asyncHandler((req, res) => controller.remove(req, res)));

export default router;
