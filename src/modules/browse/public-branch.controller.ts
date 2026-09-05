import { Request, Response } from "express";
import { PublicBranchService } from "@/modules/browse/public-branch.service";
import { BranchSearchQuery } from "@/modules/browse/public-branch.types";

const publicBranchService = new PublicBranchService();

export class PublicBranchController {
  /** GET /public/branches -> bare array, matching the proposal's example and the existing
   *  public-array precedent (GET /availability/slots, GET /availability/staff). */
  async search(req: Request, res: Response): Promise<void> {
    const results = await publicBranchService.search(req.query as unknown as BranchSearchQuery);
    res.status(200).json(results);
  }

  /** GET /public/branches/:branchId -> bare object, matching the proposal's example. */
  async getDetail(req: Request, res: Response): Promise<void> {
    const detail = await publicBranchService.getDetail(req.params.branchId);
    res.status(200).json(detail);
  }
}
