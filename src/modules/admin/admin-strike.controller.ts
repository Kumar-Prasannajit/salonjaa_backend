import { Request, Response } from "express";
import { AdminStrikeService } from "@/modules/admin/admin-strike.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminStrikeService = new AdminStrikeService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminStrikeController {
  async list(req: Request, res: Response): Promise<void> {
    const summary = await adminStrikeService.listForCustomer(req.params.customerId);
    res.status(200).json({ success: true, data: summary });
  }

  async add(req: Request, res: Response): Promise<void> {
    const row = await adminStrikeService.add(req.user!.id, req.params.customerId, req.body, requestMeta(req));
    res.status(201).json({ success: true, data: row });
  }

  async remove(req: Request, res: Response): Promise<void> {
    const row = await adminStrikeService.remove(req.user!.id, req.params.customerId, req.params.strikeId, req.body.reason, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }
}
