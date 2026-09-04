import { Request, Response } from "express";
import { AdminRefundService } from "@/modules/admin/admin-refund.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminRefundService = new AdminRefundService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminRefundController {
  async list(req: Request, res: Response): Promise<void> {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await adminRefundService.list(status);
    res.status(200).json({ success: true, data: rows });
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const row = await adminRefundService.getOne(req.params.id);
    res.status(200).json({ success: true, data: row });
  }

  async approve(req: Request, res: Response): Promise<void> {
    const row = await adminRefundService.approve(req.user!.id, req.params.id, req.body?.notes, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }

  async reject(req: Request, res: Response): Promise<void> {
    const row = await adminRefundService.reject(req.user!.id, req.params.id, req.body.reason, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }
}
