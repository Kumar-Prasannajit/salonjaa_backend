import { Router } from "express";
import { SalonController } from "@/modules/salon/salon.controller";
import { SalonAnalyticsController } from "@/modules/salon/salon-analytics.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import {
  createSalonSchema,
  updateSalonSchema,
  salonIdParamSchema,
  galleryImageIdParamSchema,
  addGalleryImageSchema,
  analyticsQuerySchema,
} from "@/modules/salon/salon.validator";
import { ROLE_NAMES } from "@/shared/constants";

const router = Router();
const controller = new SalonController();
const analyticsController = new SalonAnalyticsController();

router.use(requireAuth, requireRole(ROLE_NAMES.SALON_OWNER));

router.post("/", validate({ body: createSalonSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.get(
  "/:salonId",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.getOne(req, res))
);
router.patch(
  "/:salonId",
  validate({ params: salonIdParamSchema, body: updateSalonSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete(
  "/:salonId",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

// Module 16 — new contract (salon_gallery_images deferred since Module 3, no endpoint).
router.get(
  "/:salonId/gallery",
  validate({ params: salonIdParamSchema }),
  asyncHandler((req, res) => controller.listGallery(req, res))
);
router.post(
  "/:salonId/gallery",
  validate({ params: salonIdParamSchema, body: addGalleryImageSchema }),
  asyncHandler((req, res) => controller.addGalleryImage(req, res))
);
router.delete(
  "/:salonId/gallery/:imageId",
  validate({ params: galleryImageIdParamSchema }),
  asyncHandler((req, res) => controller.removeGalleryImage(req, res))
);

// Module 16 — new contract (owner-facing analytics, beyond Admin's platform-wide reports overview).
router.get(
  "/:salonId/analytics",
  validate({ params: salonIdParamSchema, query: analyticsQuerySchema }),
  asyncHandler((req, res) => analyticsController.getOverview(req, res))
);

export default router;
