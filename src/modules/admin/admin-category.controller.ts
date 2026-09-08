import { Request, Response } from "express";
import { AdminCategoryService } from "@/modules/admin/admin-category.service";
import { RequestMeta } from "@/modules/admin/admin.service";

const adminCategoryService = new AdminCategoryService();

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

export class AdminCategoryController {
  async list(req: Request, res: Response): Promise<void> {
    const rows = await adminCategoryService.list();
    res.status(200).json({ success: true, data: rows });
  }

  async create(req: Request, res: Response): Promise<void> {
    const row = await adminCategoryService.create(req.user!.id, req.body, requestMeta(req));
    res.status(201).json({ success: true, data: row });
  }

  async update(req: Request, res: Response): Promise<void> {
    const row = await adminCategoryService.update(req.user!.id, req.params.id, req.body, requestMeta(req));
    res.status(200).json({ success: true, data: row });
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminCategoryService.remove(req.user!.id, req.params.id, requestMeta(req));
    res.status(204).send();
  }
}
