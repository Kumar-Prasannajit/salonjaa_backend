import { Router } from "express";
import { AdminController } from "@/modules/admin/admin.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  salonIdParamSchema,
  listSalonsQuerySchema,
  rejectSalonSchema,
  suspendSalonSchema,
} from "@/modules/admin/admin.validator";
import { ROLE_NAMES } from "@/shared/constants";

// No documented Admin API inventory exists anywhere (frontend_handover.md's Admin section is
// explicitly empty; context.md lists this as a Pending Decision). This module's shape was
// worked out directly with the user rather than taken from a spec — see docs/PROGRESS.md.
const router = Router();
const controller = new AdminController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/salons", validate({ query: listSalonsQuerySchema }), asyncHandler((req, res) => controller.listSalons(req, res)));
router.get("/salons/:salonId", validate({ params: salonIdParamSchema }), asyncHandler((req, res) => controller.getSalon(req, res)));

router.post(
  "/salons/:salonId/verify",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.verifySalon(req, res))
);
router.post(
  "/salons/:salonId/reject",
  validate({ params: salonIdParamSchema, body: rejectSalonSchema }),
  asyncHandler((req, res) => controller.rejectSalon(req, res))
);
router.post(
  "/salons/:salonId/suspend",
  validate({ params: salonIdParamSchema, body: suspendSalonSchema }),
  asyncHandler((req, res) => controller.suspendSalon(req, res))
);
router.post(
  "/salons/:salonId/reactivate",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.reactivateSalon(req, res))
);

export default router;
