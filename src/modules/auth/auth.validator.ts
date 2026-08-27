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

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "refreshToken is required"),
});
