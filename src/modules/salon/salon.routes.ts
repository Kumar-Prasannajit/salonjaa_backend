import { Router } from "express";
import { SalonController } from "@/modules/salon/salon.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { createSalonSchema, updateSalonSchema, salonIdParamSchema } from "@/modules/salon/salon.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new SalonController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createSalonSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.get(
  "/:salonId",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.getOne(req, res))
);
router.patch(
  "/:salonId",
  validate({ params: salonIdParamSchema, body: updateSalonSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete(
  "/:salonId",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

export default router;
