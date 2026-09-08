import { Request, Response } from "express";
import { AdminSettlementService } from "@/modules/admin/admin-settlement.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminSettlementService = new AdminSettlementService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminSettlementController {
  async list(req: Request, res: Response): Promise<void> {
    const salonId = typeof req.query.salonId === "string" ? req.query.salonId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await adminSettlementService.list(salonId, status);
    res.status(200).json({ success: true, data: rows });
  }

  async create(req: Request, res: Response): Promise<void> {
    const row = await adminSettlementService.create(req.user!.id, req.body, requestMeta(req));
    res.status(201).json({ success: true, data: row });
  }

  async markSettled(req: Request, res: Response): Promise<void> {
    const row = await adminSettlementService.markSettled(req.user!.id, req.params.id, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }
}
