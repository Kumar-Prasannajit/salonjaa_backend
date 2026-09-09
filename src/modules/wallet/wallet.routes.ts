import { Router } from "express";
import { WalletController } from "@/modules/wallet/wallet.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { requireRole } from "@/middleware/role.middleware";
import { asyncHandler } from "@/shared/async-handler";
import { ROLE_NAMES } from "@/shared/constants";

// Module 20 — new contract, co-defined with the user (not from frontend_handover.md, same
// "propose then build" pattern as Browse/Admin before their contracts existed). Customer-only,
// same reasoning as Payment's /my-payments, /refunds etc.
const router = Router();
const controller = new WalletController();

router.use(requireAuth, requireRole(ROLE_NAMES.CUSTOMER));

router.get("/", asyncHandler((req, res) => controller.getBalance(req, res)));
router.get("/transactions", asyncHandler((req, res) => controller.listTransactions(req, res)));

export default router;
