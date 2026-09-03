import { Request, Response } from "express";
import { ServiceService } from "@/modules/service/service.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const serviceService = new ServiceService();

export class ServiceController {
  async create(req: Request, res: Response): Promise<void> {
    const row = await serviceService.create(req.user!.id, req.body);
    sendCreated(res, row);
  }

  async list(req: Request, res: Response): Promise<void> {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const rows = await serviceService.list(req.user!.id, branchId);
    sendSuccess(res, rows);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const row = await serviceService.getOne(req.user!.id, req.params.id);
    sendSuccess(res, row);
  }

  async update(req: Request, res: Response): Promise<void> {
    const row = await serviceService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, row);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await serviceService.remove(req.user!.id, req.params.id);
    sendNoContent(res);
  }

  async assignStaff(req: Request, res: Response): Promise<void> {
    await serviceService.assignStaff(req.user!.id, req.params.id, req.body.staffId);
    sendCreated(res, { serviceId: req.params.id, staffId: req.body.staffId });
  }

  async removeAssignment(req: Request, res: Response): Promise<void> {
    await serviceService.removeAssignment(req.user!.id, req.params.id, req.params.staffId);
    sendNoContent(res);
  }
}
