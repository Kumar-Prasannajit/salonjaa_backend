import { Router } from "express";
import { BookingController } from "@/modules/booking/booking.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createBookingSchema,
  bookingIdParamSchema,
  cancelBookingSchema,
  rescheduleRequestSchema,
  rejectRescheduleSchema,
  myBookingsQuerySchema,
} from "@/modules/booking/booking.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new BookingController();

router.use(requireAuth);

router.post(
  "/",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: createBookingSchema }),
  asyncHandler((req, res) => controller.create(req, res))
);

router.get(
  "/my-bookings",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ query: myBookingsQuerySchema }),
  asyncHandler((req, res) => controller.myBookings(req, res))
);

// Detail: customer owner, owning Salon Owner, or Admin — enforced in the service, not here.
router.get(
  "/:id",
  validate({ params: bookingIdParamSchema }),
  asyncHandler((req, res) => controller.getDetail(req, res))
);

router.post(
  "/:id/cancel",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ params: bookingIdParamSchema, body: cancelBookingSchema }),
  asyncHandler((req, res) => controller.cancel(req, res))
);

router.post(
  "/:id/reschedule-request",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ params: bookingIdParamSchema, body: rescheduleRequestSchema }),
  asyncHandler((req, res) => controller.requestReschedule(req, res))
);

// Responder (owning Salon Owner or the booking's own customer) is resolved in the service
// based on who proposed the pending request, not by role here — see
// BookingService.assertRescheduleResponder's doc comment (Module 15).
router.post(
  "/:id/approve-reschedule",
  validate({ params: bookingIdParamSchema }),
  asyncHandler((req, res) => controller.approveReschedule(req, res))
);

router.post(
  "/:id/reject-reschedule",
  validate({ params: bookingIdParamSchema, body: rejectRescheduleSchema }),
  asyncHandler((req, res) => controller.rejectReschedule(req, res))
);

export default router;
