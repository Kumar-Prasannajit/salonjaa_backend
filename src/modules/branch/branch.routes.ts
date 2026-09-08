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
  slotTemplateIdParamSchema,
  createSlotTemplateSchema,
  updateSlotTemplateSchema,
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

// Module 16 — new CRUD (branch_slot_templates deferred since Module 3/5), wired into
// AvailabilityService.buildCandidateWindows.
router.get(
  "/:id/slot-templates",
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => controller.listSlotTemplates(req, res))
);
router.post(
  "/:id/slot-templates",
  validate({ params: branchIdParamSchema, body: createSlotTemplateSchema }),
  asyncHandler((req, res) => controller.createSlotTemplate(req, res))
);
router.patch(
  "/:id/slot-templates/:templateId",
  validate({ params: slotTemplateIdParamSchema, body: updateSlotTemplateSchema }),
  asyncHandler((req, res) => controller.updateSlotTemplate(req, res))
);
router.delete(
  "/:id/slot-templates/:templateId",
  validate({ params: slotTemplateIdParamSchema }),
  asyncHandler((req, res) => controller.deleteSlotTemplate(req, res))
);

export default router;
