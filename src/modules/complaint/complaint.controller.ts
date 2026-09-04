import { Request, Response } from "express";
import { ComplaintService } from "@/modules/complaint/complaint.service";

const complaintService = new ComplaintService();

export class ComplaintController {
  async create(req: Request, res: Response): Promise<void> {
    const complaint = await complaintService.file(req.user!.id, req.body);
    res.status(201).json({ success: true, data: complaint });
  }
}
