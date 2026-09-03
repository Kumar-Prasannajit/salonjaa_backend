import { Router } from "express";
import { AvailabilityController } from "@/modules/availability/availability.controller";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { availabilityQuerySchema } from "@/modules/availability/availability.validator";

const router = Router();
const controller = new AvailabilityController();

// Public discovery endpoints — no requireAuth, per frontend_handover.md.
router.get("/slots", validate({ query: availabilityQuerySchema }), asyncHandler((req, res) => controller.getSlots(req, res)));
router.get("/staff", validate({ query: availabilityQuerySchema }), asyncHandler((req, res) => controller.getStaff(req, res)));

export default router;
