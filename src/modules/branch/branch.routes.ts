import { Router } from "express";
import { BranchController } from "@/modules/branch/branch.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createBranchSchema,
  updateBranchSchema,
  branchIdParamSchema,
  holidayIdParamSchema,
  createHolidaySchema,
  capacityRuleSchema,
} from "@/modules/branch/branch.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new BranchController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createBranchSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.get(
  "/:id",
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => controller.getOne(req, res))
);
router.patch(
  "/:id",
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);

router.post(
  "/:id/holidays",
  validate({ params: branchIdParamSchema, body: createHolidaySchema }),
  asyncHandler((req, res) => controller.createHoliday(req, res))
);
router.delete(
  "/:id/holidays/:holidayId",
  validate({ params: holidayIdParamSchema }),
  asyncHandler((req, res) => controller.deleteHoliday(req, res))
);

router.post(
  "/:id/capacity-rule",
  validate({ params: branchIdParamSchema, body: capacityRuleSchema }),
  asyncHandler((req, res) => controller.setCapacityRule(req, res))
);

export default router;
