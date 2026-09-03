import { Request, Response } from "express";
import { ReviewService } from "@/modules/review/review.service";

const reviewService = new ReviewService();

export class ReviewController {
  async create(req: Request, res: Response): Promise<void> {
    const review = await reviewService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: review });
  }

  async update(req: Request, res: Response): Promise<void> {
    const review = await reviewService.update(req.user!.id, req.params.reviewId, req.body);
    res.status(200).json({ success: true, data: review });
  }

  async getDetail(req: Request, res: Response): Promise<void> {
    const review = await reviewService.getDetail(req.params.reviewId);
    res.status(200).json({ success: true, data: review });
  }

  async listBySalon(req: Request, res: Response): Promise<void> {
    const rows = await reviewService.listBySalon(req.params.salonId);
    res.status(200).json({ success: true, data: rows });
  }

  async listByService(req: Request, res: Response): Promise<void> {
    const rows = await reviewService.listByService(req.params.serviceId);
    res.status(200).json({ success: true, data: rows });
  }

  async listByStaff(req: Request, res: Response): Promise<void> {
    const rows = await reviewService.listByStaff(req.params.staffId);
    res.status(200).json({ success: true, data: rows });
  }

  async report(req: Request, res: Response): Promise<void> {
    await reviewService.report(req.user!.id, req.params.reviewId, req.body?.reason);
    res.status(201).json({ success: true });
  }

  async reply(req: Request, res: Response): Promise<void> {
    const review = await reviewService.reply(req.user!.id, req.params.reviewId, req.body.message);
    res.status(201).json({ success: true, data: review });
  }
}
