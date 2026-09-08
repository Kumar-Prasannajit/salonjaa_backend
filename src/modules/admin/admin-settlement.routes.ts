import { Router } from "express";
import { AdminSettlementController } from "@/modules/admin/admin-settlement.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { settlementIdParamSchema, createSettlementSchema, listSettlementsQuerySchema } from "@/modules/admin/admin-settlement.validator";
import { ROLE_NAMES } from "@/shared/constants";

// Module 16 — new contract (ADMIN_CONTRACT.md explicitly excluded settlement creation).
const router = Router();
const controller = new AdminSettlementController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", validate({ query: listSettlementsQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));
router.post("/", validate({ body: createSettlementSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.post(
  "/:id/mark-settled",
  validate({ params: settlementIdParamSchema }),
  asyncHandler((req, res) => controller.markSettled(req, res))
);

export default router;
