import { Router } from "express";
import { AddressController } from "@/modules/address/address.controller";
import { validate } from "@/middleware/validate.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { createAddressSchema, updateAddressSchema, addressIdParamSchema } from "@/modules/address/address.validator";

const router = Router();
const controller = new AddressController();

router.get("/", asyncHandler((req, res) => controller.list(req, res)));
router.post("/", validate({ body: createAddressSchema }), asyncHandler((req, res) => controller.create(req, res)));
router.patch(
  "/:id",
  validate({ params: addressIdParamSchema, body: updateAddressSchema }),
  asyncHandler((req, res) => controller.update(req, res))
);
router.delete(
  "/:id",
  validate({ params: addressIdParamSchema }),
  asyncHandler((req, res) => controller.remove(req, res))
);

export default router;
