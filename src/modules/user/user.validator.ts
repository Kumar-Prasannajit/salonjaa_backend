import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be YYYY-MM-DD")
    .refine((val) => !Number.isNaN(Date.parse(val)), "dob must be a valid date")
    .refine((val) => new Date(val).getTime() < Date.now(), "dob must be in the past")
    .optional(),
});

export const myBookingHistoryQuerySchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED", "UPCOMING"]).optional(),
});
