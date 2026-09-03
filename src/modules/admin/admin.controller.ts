import { Request, Response } from "express";
import { AdminService, RequestMeta } from "@/modules/admin/admin.service";

const adminService = new AdminService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminController {
  async listSalons(req: Request, res: Response): Promise<void> {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await adminService.listSalons(status);
    res.status(200).json({ success: true, data: rows });
  }

  async getSalon(req: Request, res: Response): Promise<void> {
    const salon = await adminService.getSalon(req.params.salonId);
    res.status(200).json({ success: true, data: salon });
  }

  async verifySalon(req: Request, res: Response): Promise<void> {
    const salon = await adminService.verifySalon(req.user!.id, req.params.salonId, requestMeta(req));
    res.status(200).json({ success: true, data: salon });
  }

  async rejectSalon(req: Request, res: Response): Promise<void> {
    const salon = await adminService.rejectSalon(req.user!.id, req.params.salonId, req.body.reason, requestMeta(req));
    res.status(200).json({ success: true, data: salon });
  }

  async suspendSalon(req: Request, res: Response): Promise<void> {
    const salon = await adminService.suspendSalon(req.user!.id, req.params.salonId, req.body.reason, requestMeta(req));
    res.status(200).json({ success: true, data: salon });
  }

  async reactivateSalon(req: Request, res: Response): Promise<void> {
    const salon = await adminService.reactivateSalon(req.user!.id, req.params.salonId, requestMeta(req));
    res.status(200).json({ success: true, data: salon });
  }
}
