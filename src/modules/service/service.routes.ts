import { Router } from "express";
import { ServiceController } from "@/modules/service/service.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createServiceSchema,
  updateServiceSchema,
  serviceIdParamSchema,
  serviceStaffParamSchema,
  serviceListQuerySchema,
  assignStaffSchema,
} from "@/modules/service/service.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new ServiceController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createServiceSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", validate({ query: serviceListQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));
router.get(
  "/:id",
  validate({ params: serviceIdParamSchema }),
  asyncHandler((req, res) => controller.getOne(req, res))
);
router.patch(
  "/:id",
  validate({ params: serviceIdParamSchema, body: updateServiceSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete(
  "/:id",
  validate({ params: serviceIdParamSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

router.post(
  "/:id/staff",
  validate({ params: serviceIdParamSchema, body: assignStaffSchema }),
  asyncHandler((req, res) => controller.assignStaff(req, res))
);
router.delete(
  "/:id/staff/:staffId",
  validate({ params: serviceStaffParamSchema }),
  asyncHandler((req, res) => controller.removeAssignment(req, res))
);

export default router;
