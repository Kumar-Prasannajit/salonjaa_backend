import { Router } from "express";
import { AdminStrikeController } from "@/modules/admin/admin-strike.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { customerIdParamSchema, strikeIdParamSchema, addStrikeSchema, removeStrikeSchema } from "@/modules/admin/admin-strike.validator";
import { ROLE_NAMES } from "@/shared/constants";

// New contract, not from ADMIN_CONTRACT.md (which explicitly excluded strikes) — co-defined
// with the user for Module 16. Mounted at /admin/customers/:customerId/strikes.
const router = Router({ mergeParams: true });
const controller = new AdminStrikeController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", validate({ params: customerIdParamSchema }), asyncHandler((req, res) => controller.list(req, res)));
router.post("/", validate({ params: customerIdParamSchema, body: addStrikeSchema }), asyncHandler((req, res) => controller.add(req, res)));
router.post(
  "/:strikeId/remove",
  validate({ params: strikeIdParamSchema, body: removeStrikeSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

export default router;
