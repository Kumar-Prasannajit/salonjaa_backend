import { Request, Response } from "express";
import { AdminComplaintService } from "@/modules/admin/admin-complaint.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminComplaintService = new AdminComplaintService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminComplaintController {
  async list(req: Request, res: Response): Promise<void> {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await adminComplaintService.list(status);
    res.status(200).json({ success: true, data: rows });
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const row = await adminComplaintService.getOne(req.params.id);
    res.status(200).json({ success: true, data: row });
  }

  async resolve(req: Request, res: Response): Promise<void> {
    const row = await adminComplaintService.resolve(req.user!.id, req.params.id, req.body.resolutionNotes, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }

  async reject(req: Request, res: Response): Promise<void> {
    const row = await adminComplaintService.reject(req.user!.id, req.params.id, req.body.reason, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }
}
