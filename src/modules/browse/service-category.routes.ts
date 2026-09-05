import { Router } from "express";
import { ServiceCategoryController } from "@/modules/browse/service-category.controller";
import { asyncHandler } from "@/shared/async-handler";

const router = Router();
const controller = new ServiceCategoryController();

// Public — backing data already exists via `npm run db:seed` (Module 4's 8 starter
// categories); this is just the first read route over it.
router.get("/", asyncHandler((req, res) => controller.list(req, res)));

export default router;
