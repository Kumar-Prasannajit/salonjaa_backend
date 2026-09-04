import { Router } from "express";
import { AdminReportController } from "@/modules/admin/admin-report.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { reportOverviewQuerySchema } from "@/modules/admin/admin-report.validator";
import { ROLE_NAMES } from "@/shared/constants";

// docs/ADMIN_CONTRACT.md §3 — deliberately minimal, not a BI tool.
const router = Router();
const controller = new AdminReportController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/overview", validate({ query: reportOverviewQuerySchema }), asyncHandler((req, res) => controller.overview(req, res)));

export default router;
