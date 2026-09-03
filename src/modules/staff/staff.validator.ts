import { z } from "zod";

export const createStaffSchema = z.object({
  branchId: z.string().uuid("Invalid branch id"),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(20).optional(),
  staffType: z.enum(["NORMAL", "STAR"]),
  experienceYears: z.number().int().min(0).optional(),
  salary: z.number().min(0).optional(),
});

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  staffType: z.enum(["NORMAL", "STAR"]).optional(),
  experienceYears: z.number().int().min(0).optional(),
  salary: z.number().min(0).optional(),
  profileImage: z.string().trim().url().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "joiningDate must be YYYY-MM-DD")
    .optional(),
  bio: z.string().trim().max(2000).optional(),
  consultationFee: z.number().min(0).optional(),
});

export const staffIdParamSchema = z.object({
  id: z.string().uuid("Invalid staff id"),
});

export const staffLeaveIdParamSchema = z.object({
  id: z.string().uuid("Invalid staff id"),
  leaveId: z.string().uuid("Invalid leave id"),
});

export const staffListQuerySchema = z.object({
  branchId: z.string().uuid("Invalid branch id").optional(),
});

export const createLeaveSchema = z
  .object({
    startDateTime: z.string().datetime({ message: "startDateTime must be a valid ISO datetime" }),
    endDateTime: z.string().datetime({ message: "endDateTime must be a valid ISO datetime" }),
    reason: z.string().trim().max(255).optional(),
  })
  .refine((data) => new Date(data.startDateTime) < new Date(data.endDateTime), {
    message: "endDateTime must be after startDateTime",
    path: ["endDateTime"],
  });
