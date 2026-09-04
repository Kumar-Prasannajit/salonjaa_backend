import { Router } from "express";
import { AdminRefundController } from "@/modules/admin/admin-refund.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  refundIdParamSchema,
  listRefundsQuerySchema,
  approveRefundSchema,
  rejectRefundSchema,
} from "@/modules/admin/admin-refund.validator";
import { ROLE_NAMES } from "@/shared/constants";

// docs/ADMIN_CONTRACT.md §1 — manual approval only, no automated eligibility logic.
const router = Router();
const controller = new AdminRefundController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", validate({ query: listRefundsQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));
router.get("/:id", validate({ params: refundIdParamSchema }), asyncHandler((req, res) => controller.getOne(req, res)));
router.post(
  "/:id/approve",
  validate({ params: refundIdParamSchema, body: approveRefundSchema }),
  asyncHandler((req, res) => controller.approve(req, res))
);
router.post(
  "/:id/reject",
  validate({ params: refundIdParamSchema, body: rejectRefundSchema }),
  asyncHandler((req, res) => controller.reject(req, res))
);

export default router;
