import { Request, Response } from "express";
import { SalonAnalyticsService } from "@/modules/salon/salon-analytics.service";
import { sendSuccess } from "@/shared/response";

const salonAnalyticsService = new SalonAnalyticsService();

export class SalonAnalyticsController {
  async getOverview(req: Request, res: Response): Promise<void> {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const overview = await salonAnalyticsService.getOverview(req.user!.id, req.params.salonId, from, to);
    sendSuccess(res, overview);
  }
}
