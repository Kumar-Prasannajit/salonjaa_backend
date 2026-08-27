import { Request, Response } from "express";
import { UserService } from "@/modules/user/user.service";

const userService = new UserService();

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
}
