import { Request, Response } from "express";
import { UserService } from "@/modules/user/user.service";
import { BookingService } from "@/modules/booking/booking.service";
import { sendSuccess } from "@/shared/response";

const userService = new UserService();
const bookingService = new BookingService();

export class UserController {
  /** GET /users/me -> { id, name, email, ... } per frontend_handover.md */
  async getMe(req: Request, res: Response): Promise<void> {
    const profile = await userService.getProfile(req.user!.id);
    res.status(200).json(profile);
  }

  /** PATCH /users/me -> updated profile (contract not fully specified; returns full profile) */
  async updateMe(req: Request, res: Response): Promise<void> {
    const profile = await userService.updateProfile(req.user!.id, req.body);
    res.status(200).json({ success: true, data: profile });
  }

  /**
   * GET /users/me/bookings — closes the gap flagged in frontend_handover.md since Module 2
   * ("depends on the bookings table, which belongs to Booking — wire it up when it ships").
   * Delegates straight to BookingService, which already owns booking data end to end; the
   * "success/error contract not supplied" note means the default envelope is fair game.
   */
  async myBookings(req: Request, res: Response): Promise<void> {
    const status = req.query.status as "COMPLETED" | "CANCELLED" | "UPCOMING" | undefined;
    const bookings = await bookingService.listMyBookingHistory(req.user!.id, status);
    sendSuccess(res, bookings);
  }
}
