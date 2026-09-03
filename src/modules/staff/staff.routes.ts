import { Router } from "express";
import { StaffController } from "@/modules/staff/staff.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createStaffSchema,
  updateStaffSchema,
  staffIdParamSchema,
  staffLeaveIdParamSchema,
  staffListQuerySchema,
  createLeaveSchema,
} from "@/modules/staff/staff.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new StaffController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createStaffSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", validate({ query: staffListQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));
router.get(
  "/:id",
  validate({ params: staffIdParamSchema }),
  asyncHandler((req, res) => controller.getOne(req, res))
);
router.patch(
  "/:id",
  validate({ params: staffIdParamSchema, body: updateStaffSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete(
  "/:id",
  validate({ params: staffIdParamSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

router.post(
  "/:id/leave",
  validate({ params: staffIdParamSchema, body: createLeaveSchema }),
  asyncHandler((req, res) => controller.createLeave(req, res))
);
router.delete(
  "/:id/leave/:leaveId",
  validate({ params: staffLeaveIdParamSchema }),
  asyncHandler((req, res) => controller.cancelLeave(req, res))
);

export default router;
