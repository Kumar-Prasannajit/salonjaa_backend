import { Router } from "express";
import { ReviewController } from "@/modules/review/review.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createReviewSchema,
  updateReviewSchema,
  reviewIdParamSchema,
  salonIdParamSchema,
  serviceIdParamSchema,
  staffIdParamSchema,
  reportReviewSchema,
  replyReviewSchema,
} from "@/modules/review/review.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new ReviewController();

// Public display routes — "Authentication: not specified; treat as public" per frontend_handover.md.
router.get("/salon/:salonId", validate({ params: salonIdParamSchema }), asyncHandler((req, res) => controller.listBySalon(req, res)));
router.get("/service/:serviceId", validate({ params: serviceIdParamSchema }), asyncHandler((req, res) => controller.listByService(req, res)));
router.get("/staff/:staffId", validate({ params: staffIdParamSchema }), asyncHandler((req, res) => controller.listByStaff(req, res)));
router.get("/:reviewId", validate({ params: reviewIdParamSchema }), asyncHandler((req, res) => controller.getDetail(req, res)));

router.post(
  "/",
  requireAuth,
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: createReviewSchema }),
  asyncHandler((req, res) => controller.create(req, res))
);

router.patch(
  "/:reviewId",
  requireAuth,
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ params: reviewIdParamSchema, body: updateReviewSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);

router.post(
  "/:reviewId/report",
  requireAuth,
  requireRole(ROLE_NAMES.CUSTOMER, ROLE_NAMES.SALON_OWNER),
  validate({ params: reviewIdParamSchema, body: reportReviewSchema }),
  asyncHandler((req, res) => controller.report(req, res))
);

router.post(
  "/:reviewId/reply",
  requireAuth,
  requireRole(ROLE_NAMES.SALON_OWNER),
  validate({ params: reviewIdParamSchema, body: replyReviewSchema }),
  asyncHandler((req, res) => controller.reply(req, res))
);

// POST /reviews/:reviewId/images has no documented request contract anywhere
// ("image upload contract not supplied") — deliberately not implemented. Decided with the user.

export default router;
