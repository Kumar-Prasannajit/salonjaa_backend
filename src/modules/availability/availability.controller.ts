import { Request, Response } from "express";
import { AvailabilityService } from "@/modules/availability/availability.service";
import { AvailabilityQuery } from "@/modules/availability/availability.types";

const availabilityService = new AvailabilityService();

export class AvailabilityController {
  /** GET /availability/slots -> bare array exactly per frontend_handover.md, no envelope. */
  async getSlots(req: Request, res: Response): Promise<void> {
    const slots = await availabilityService.getSlots(req.query as unknown as AvailabilityQuery);
    res.status(200).json(slots);
  }

  /** GET /availability/staff -> bare array exactly per frontend_handover.md, no envelope. */
  async getStaff(req: Request, res: Response): Promise<void> {
    const eligibleStaff = await availabilityService.getEligibleStaff(req.query as unknown as AvailabilityQuery);
    res.status(200).json(eligibleStaff);
  }
}
