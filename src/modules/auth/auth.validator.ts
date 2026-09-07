import { z } from "zod";

export const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "OTP must be numeric"),
});

// Module 14: refreshToken is now optional in the body — a browser client relies on the
// httpOnly refreshToken cookie instead. The controller enforces "must have one or the
// other" itself (see auth.controller.ts) since that's a cross-field/cross-source rule
// zod can't express against req.cookies here.
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "refreshToken is required").optional(),
});
