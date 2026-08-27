import { Request, Response } from "express";
import { AuthService } from "@/modules/auth/auth.service";

const authService = new AuthService();

export class AuthController {
  /** POST /auth/send-otp -> { success, message } exactly per frontend_handover.md */
  async sendOtp(req: Request, res: Response): Promise<void> {
    await authService.sendOtp(req.body.email);
    res.status(200).json({ success: true, message: "OTP sent successfully" });
  }

  /** POST /auth/verify-otp -> { success, accessToken, refreshToken, user } exactly per frontend_handover.md */
  async verifyOtp(req: Request, res: Response): Promise<void> {
    const result = await authService.verifyOtp(req.body.email, req.body.otp);
    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }

  /** POST /auth/refresh-token -> { accessToken } exactly per frontend_handover.md */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.status(200).json({ accessToken: result.accessToken });
  }

  /** POST /auth/logout -> { success } exactly per frontend_handover.md */
  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(req.body?.refreshToken);
    res.status(200).json({ success: true });
  }
}
