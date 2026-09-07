import { Request, Response } from "express";
import { AuthService } from "@/modules/auth/auth.service";
import { UnauthorizedError } from "@/shared/errors";
import { setAuthCookies, setAccessTokenCookie, clearAuthCookies } from "@/shared/cookies";

const authService = new AuthService();

export class AuthController {
  /** POST /auth/send-otp -> { success, message } exactly per frontend_handover.md */
  async sendOtp(req: Request, res: Response): Promise<void> {
    await authService.sendOtp(req.body.email);
    res.status(200).json({ success: true, message: "OTP sent successfully" });
  }

  /**
   * POST /auth/verify-otp -> { success, accessToken, refreshToken, user } exactly per
   * frontend_handover.md — unchanged. Module 14 additionally sets httpOnly
   * accessToken/refreshToken cookies plus a JS-readable csrfToken cookie (see
   * shared/cookies.ts) so a browser client no longer needs to hold tokens in JS memory to
   * stay authenticated across a reload.
   */
  async verifyOtp(req: Request, res: Response): Promise<void> {
    const result = await authService.verifyOtp(req.body.email, req.body.otp);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }

  /**
   * POST /auth/refresh-token -> { accessToken } exactly per frontend_handover.md — unchanged.
   * Module 14: refreshToken can now come from the body (existing API clients) or the
   * refreshToken cookie (browser client) — body takes precedence when both are present.
   * Also rotates the accessToken cookie on success.
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError("refreshToken is required (body or cookie)");
    }
    const result = await authService.refreshAccessToken(refreshToken);
    setAccessTokenCookie(res, result.accessToken);
    res.status(200).json({ accessToken: result.accessToken });
  }

  /**
   * POST /auth/logout -> { success } exactly per frontend_handover.md — unchanged.
   * Module 14: also accepts refreshToken via cookie, and always clears the auth+csrf
   * cookies regardless of which source the token came from.
   */
  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;
    await authService.logout(refreshToken);
    clearAuthCookies(res);
    res.status(200).json({ success: true });
  }
}
