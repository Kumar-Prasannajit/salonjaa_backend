import { Router } from "express";
import { z } from "zod";
import { PublicPromotionController } from "@/modules/browse/promotion.controller";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";

const listPromotionsQuerySchema = z.object({
  branchId: z.string().uuid("Invalid branch id").optional(),
});

// Module 16 — public discovery, no auth (same precedent as GET /public/branches).
const router = Router();
const controller = new PublicPromotionController();

router.get("/", validate({ query: listPromotionsQuerySchema }), asyncHandler((req, res) => controller.list(req, res)));

export default router;
