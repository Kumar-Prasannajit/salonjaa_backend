import { Router } from "express";
import { ComplaintController } from "@/modules/complaint/complaint.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { fileComplaintSchema } from "@/modules/complaint/complaint.validator";
import { ROLE_NAMES } from "@/shared/constants";

// docs/ADMIN_CONTRACT.md §2 — filed by Customer or Salon Owner, NOT under /admin.
// Resolution side (GET/resolve/reject) lives in src/modules/admin/admin-complaint.*.
const router = Router();
const controller = new ComplaintController();

router.post(
  "/",
  requireAuth,
  requireRole(ROLE_NAMES.CUSTOMER, ROLE_NAMES.SALON_OWNER),
  validate({ body: fileComplaintSchema }),
  asyncHandler((req, res) => controller.create(req, res))
);

export default router;
