import { Request, Response } from "express";
import { BookingService } from "@/modules/booking/booking.service";

const bookingService = new BookingService();

export class BookingController {
  /** POST /bookings -> { bookingId, status } exactly per frontend_handover.md */
  async create(req: Request, res: Response): Promise<void> {
    const result = await bookingService.create(req.user!.id, req.body);
    res.status(201).json({ bookingId: result.bookingId, status: result.status });
  }

  /** GET /bookings/:id -> { booking: {} } exactly per frontend_handover.md */
  async getDetail(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.getDetail(req.user!.id, req.user!.roles, req.params.id);
    res.status(200).json({ booking });
  }

  async myBookings(req: Request, res: Response): Promise<void> {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await bookingService.listMyBookings(req.user!.id, status);
    res.status(200).json({ success: true, data: rows });
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.cancel(req.user!.id, req.params.id, req.body?.reason);
    res.status(200).json({ success: true, data: booking });
  }

  async requestReschedule(req: Request, res: Response): Promise<void> {
    const request = await bookingService.requestReschedule(req.user!.id, req.params.id, req.body);
    res.status(201).json({ success: true, data: request });
  }

  async approveReschedule(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.approveReschedule(req.user!.id, req.params.id);
    res.status(200).json({ success: true, data: booking });
  }

  async rejectReschedule(req: Request, res: Response): Promise<void> {
    const request = await bookingService.rejectReschedule(req.user!.id, req.params.id, req.body?.reason);
    res.status(200).json({ success: true, data: request });
  }

  // ---- Salon-owner side ----

  async listSalonBookings(req: Request, res: Response): Promise<void> {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await bookingService.listSalonBookings(req.user!.id, status);
    res.status(200).json({ success: true, data: rows });
  }

  async approve(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.approve(req.user!.id, req.params.id, req.body);
    res.status(200).json({ success: true, data: booking });
  }

  async reject(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.reject(req.user!.id, req.params.id, req.body.reason);
    res.status(200).json({ success: true, data: booking });
  }

  async proposeReschedule(req: Request, res: Response): Promise<void> {
    const request = await bookingService.proposeReschedule(req.user!.id, req.params.id, req.body);
    res.status(201).json({ success: true, data: request });
  }

  async walkIn(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.walkIn(req.user!.id, req.body);
    res.status(201).json({ success: true, data: booking });
  }
}
