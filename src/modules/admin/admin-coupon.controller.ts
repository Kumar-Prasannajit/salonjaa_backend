import { Request, Response } from "express";
import { AdminCouponService } from "@/modules/admin/admin-coupon.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminCouponService = new AdminCouponService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminCouponController {
  async list(req: Request, res: Response): Promise<void> {
    const rows = await adminCouponService.list();
    res.status(200).json({ success: true, data: rows });
  }

  async create(req: Request, res: Response): Promise<void> {
    const row = await adminCouponService.create(req.user!.id, req.body, requestMeta(req));
    res.status(201).json({ success: true, data: row });
  }

  async update(req: Request, res: Response): Promise<void> {
    const row = await adminCouponService.update(req.user!.id, req.params.id, req.body, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminCouponService.remove(req.user!.id, req.params.id, requestMeta(req));
    res.status(204).send();
  }
}
