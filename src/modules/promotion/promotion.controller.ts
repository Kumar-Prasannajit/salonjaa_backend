import { Request, Response } from "express";
import { PromotionService } from "@/modules/promotion/promotion.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const promotionService = new PromotionService();

export class PromotionController {
  async create(req: Request, res: Response): Promise<void> {
    const promotion = await promotionService.create(req.user!.id, req.body);
    sendCreated(res, promotion);
  }

  async list(req: Request, res: Response): Promise<void> {
    const promotions = await promotionService.listMine(req.user!.id);
    sendSuccess(res, promotions);
  }

  async update(req: Request, res: Response): Promise<void> {
    const promotion = await promotionService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, promotion);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await promotionService.remove(req.user!.id, req.params.id);
    sendNoContent(res);
  }
}
