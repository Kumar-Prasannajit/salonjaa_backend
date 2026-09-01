import { Request, Response } from "express";
import { BranchService } from "@/modules/branch/branch.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const branchService = new BranchService();

export class BranchController {
  async create(req: Request, res: Response): Promise<void> {
    const branch = await branchService.create(req.user!.id, req.body);
    sendCreated(res, branch);
  }

  async list(req: Request, res: Response): Promise<void> {
    const salonId = typeof req.query.salonId === "string" ? req.query.salonId : undefined;
    const branches = await branchService.list(req.user!.id, salonId);
    sendSuccess(res, branches);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const branch = await branchService.getOne(req.user!.id, req.params.id);
    sendSuccess(res, branch);
  }

  async update(req: Request, res: Response): Promise<void> {
    const branch = await branchService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, branch);
  }

  async createHoliday(req: Request, res: Response): Promise<void> {
    const holiday = await branchService.createHoliday(req.user!.id, req.params.id, req.body);
    sendCreated(res, holiday);
  }

  async deleteHoliday(req: Request, res: Response): Promise<void> {
    await branchService.deleteHoliday(req.user!.id, req.params.id, req.params.holidayId);
    sendNoContent(res);
  }

  async setCapacityRule(req: Request, res: Response): Promise<void> {
    const rule = await branchService.setCapacityRule(req.user!.id, req.params.id, req.body.maxCapacityOverride);
    sendSuccess(res, rule);
  }
}
