import { Router } from "express";
import { PublicBranchController } from "@/modules/browse/public-branch.controller";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { branchSearchQuerySchema, branchIdParamSchema } from "@/modules/browse/public-branch.validator";

const router = Router();
const controller = new PublicBranchController();

// Fully public — no requireAuth, per docs/PROPOSED_PUBLIC_BROWSE_CONTRACT.md's "browsing stays
// anonymous" auth model (Home -> Explore -> Salon Details -> Select Services -> Checkout is
// where auth first becomes required, on POST /bookings, unchanged by this module).
router.get("/", validate({ query: branchSearchQuerySchema }), asyncHandler((req, res) => controller.search(req, res)));
router.get(
  "/:branchId",
  validate({ params: branchIdParamSchema }),
  asyncHandler((req, res) => controller.getDetail(req, res))
);

export default router;
