import { Request, Response } from "express";
import { PublicPromotionService } from "@/modules/browse/promotion.service";
import { sendSuccess } from "@/shared/response";

const publicPromotionService = new PublicPromotionService();

export class PublicPromotionController {
  async list(req: Request, res: Response): Promise<void> {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const rows = await publicPromotionService.listActive(branchId);
    sendSuccess(res, rows);
  }
}
