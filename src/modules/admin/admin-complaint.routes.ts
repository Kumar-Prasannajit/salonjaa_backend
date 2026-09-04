import { Router } from "express";
import { AdminComplaintController } from "@/modules/admin/admin-complaint.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  complaintIdParamSchema,
  listComplaintsQuerySchema,
  resolveComplaintSchema,
  rejectComplaintSchema,
} from "@/modules/admin/admin-complaint.validator";
import { ROLE_NAMES } from "@/shared/constants";

// docs/ADMIN_CONTRACT.md §2 — resolution side. Filing side (POST /complaints) lives in
// src/modules/complaint/ — see that module's routes file for the reasoning.
const router = Router();
const controller = new AdminComplaintController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", validate({ query: listComplaintsQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));
router.get("/:id", validate({ params: complaintIdParamSchema }), asyncHandler((req, res) => controller.getOne(req, res)));
router.post(
  "/:id/resolve",
  validate({ params: complaintIdParamSchema, body: resolveComplaintSchema }),
  asyncHandler((req, res) => controller.resolve(req, res))
);
router.post(
  "/:id/reject",
  validate({ params: complaintIdParamSchema, body: rejectComplaintSchema }),
  asyncHandler((req, res) => controller.reject(req, res))
);

export default router;
