import { Request, Response } from "express";
import { AdminReportService } from "@/modules/admin/admin-report.service";

const adminReportService = new AdminReportService();

export class AdminReportController {
  async overview(req: Request, res: Response): Promise<void> {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const data = await adminReportService.getOverview(from, to);
    res.status(200).json({ success: true, data });
  }
}
