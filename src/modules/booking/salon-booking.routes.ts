import { Router } from "express";
import { BookingController } from "@/modules/booking/booking.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  bookingIdParamSchema,
  approveBookingSchema,
  rejectBookingSchema,
  proposeRescheduleSchema,
  walkInSchema,
  salonBookingsQuerySchema,
} from "@/modules/booking/booking.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new BookingController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.get("/", validate({ query: salonBookingsQuerySchema }), asyncHandler((req, res) => controller.listSalonBookings(req, res)));

router.post(
  "/walk-in",
  validate({ body: walkInSchema }),
  asyncHandler((req, res) => controller.walkIn(req, res))
);

router.post(
  "/:id/approve",
  validate({ params: bookingIdParamSchema, body: approveBookingSchema }),
  asyncHandler((req, res) => controller.approve(req, res))
);

router.post(
  "/:id/reject",
  validate({ params: bookingIdParamSchema, body: rejectBookingSchema }),
  asyncHandler((req, res) => controller.reject(req, res))
);

router.post(
  "/:id/propose-reschedule",
  validate({ params: bookingIdParamSchema, body: proposeRescheduleSchema }),
  asyncHandler((req, res) => controller.proposeReschedule(req, res))
);

// Module 16 — no documented contract existed anywhere for NO_SHOW (context.md flagged the
// enum gap itself; TRD §13's approval flow mentions it only as "generate the booking
// check-in OTP," which this codebase never built). Co-defined with the user: owner marks it
// manually, any time after scheduledStart.
router.post(
  "/:id/no-show",
  validate({ params: bookingIdParamSchema }),
  asyncHandler((req, res) => controller.markNoShow(req, res))
);

// BUG-007 fix — same "no documented contract, follow the no-show precedent" reasoning as
// above: owner marks an APPROVED booking complete manually, any time at/after scheduledStart.
router.post(
  "/:id/complete",
  validate({ params: bookingIdParamSchema }),
  asyncHandler((req, res) => controller.markComplete(req, res))
);

// POST /salon-bookings/:id/block-slot is explicitly "Future Feature — Not MVP" in
// frontend_handover.md — deliberately not implemented.

export default router;
