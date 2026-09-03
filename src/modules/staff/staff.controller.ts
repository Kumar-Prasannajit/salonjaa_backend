import { Request, Response } from "express";
import { StaffService } from "@/modules/staff/staff.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const staffService = new StaffService();

export class StaffController {
  async create(req: Request, res: Response): Promise<void> {
    const row = await staffService.create(req.user!.id, req.body);
    sendCreated(res, row);
  }

  async list(req: Request, res: Response): Promise<void> {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const rows = await staffService.list(req.user!.id, branchId);
    sendSuccess(res, rows);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const row = await staffService.getOne(req.user!.id, req.params.id);
    sendSuccess(res, row);
  }

  async update(req: Request, res: Response): Promise<void> {
    const row = await staffService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, row);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await staffService.remove(req.user!.id, req.params.id);
    sendNoContent(res);
  }

  async createLeave(req: Request, res: Response): Promise<void> {
    const leave = await staffService.createLeave(req.user!.id, req.params.id, req.body);
    sendCreated(res, leave);
  }

  async cancelLeave(req: Request, res: Response): Promise<void> {
    await staffService.cancelLeave(req.user!.id, req.params.id, req.params.leaveId);
    sendNoContent(res);
  }
}
