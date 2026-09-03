import { Router } from "express";
import { PaymentController } from "@/modules/payment/payment.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createOrderSchema,
  verifyPaymentSchema,
  paymentIdParamSchema,
  refundRequestSchema,
  validateCouponSchema,
} from "@/modules/payment/payment.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new PaymentController();

router.use(requireAuth);

router.post(
  "/create-order",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: createOrderSchema }),
  asyncHandler((req, res) => controller.createOrder(req, res))
);

router.post(
  "/verify",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: verifyPaymentSchema }),
  asyncHandler((req, res) => controller.verify(req, res))
);

router.get(
  "/my-payments",
  requireRole(ROLE_NAMES.CUSTOMER),
  asyncHandler((req, res) => controller.myPayments(req, res))
);

router.post(
  "/refund-request",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: refundRequestSchema }),
  asyncHandler((req, res) => controller.requestRefund(req, res))
);

router.get(
  "/refunds",
  requireRole(ROLE_NAMES.CUSTOMER),
  asyncHandler((req, res) => controller.myRefunds(req, res))
);

router.get(
  "/salon-settlements",
  requireRole(ROLE_NAMES.SALON_OWNER),
  asyncHandler((req, res) => controller.salonSettlements(req, res))
);

router.post(
  "/coupons/validate",
  requireRole(ROLE_NAMES.CUSTOMER),
  validate({ body: validateCouponSchema }),
  asyncHandler((req, res) => controller.validateCoupon(req, res))
);

// Detail: payment's own customer, owning Salon Owner, or Admin — enforced in the service.
// Registered last so it doesn't shadow the fixed-path routes above.
router.get(
  "/:paymentId",
  validate({ params: paymentIdParamSchema }),
  asyncHandler((req, res) => controller.getDetail(req, res))
);

export default router;
