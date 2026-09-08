import { Router } from "express";
import { AdminCategoryController } from "@/modules/admin/admin-category.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { categoryIdParamSchema, createCategorySchema, updateCategorySchema } from "@/modules/admin/admin-category.validator";
import { ROLE_NAMES } from "@/shared/constants";

// Module 16 — new contract (ADMIN_CONTRACT.md explicitly excluded category management).
const router = Router();
const controller = new AdminCategoryController();

router.use(requireAuth, requireRole(ROLE_NAMES.ADMIN));

router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.post("/", validate({ body: createCategorySchema }), asyncHandler((req, res) => controller.create(req, res)));
router.patch(
  "/:id",
  validate({ params: categoryIdParamSchema, body: updateCategorySchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete("/:id", validate({ params: categoryIdParamSchema }), asyncHandler((req, res) => controller.remove(req, res)));

export default router;
