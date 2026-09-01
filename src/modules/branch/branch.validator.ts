import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be HH:MM (24-hour)");

export const createBranchSchema = z
  .object({
    salonId: z.string().uuid("Invalid salon id"),
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(20).optional(),
    email: z.string().trim().email().optional(),
    addressLine1: z.string().trim().min(1).max(255),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(20),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    totalChairs: z.number().int().positive("totalChairs must be > 0"),
    openingTime: timeSchema,
    closingTime: timeSchema,
  })
  .refine((data) => data.openingTime < data.closingTime, {
    message: "openingTime must be before closingTime",
    path: ["closingTime"],
  });

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().max(20).optional(),
    email: z.string().trim().email().optional(),
    addressLine1: z.string().trim().min(1).max(255).optional(),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    postalCode: z.string().trim().min(1).max(20).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    totalChairs: z.number().int().positive().optional(),
    openingTime: timeSchema.optional(),
    closingTime: timeSchema.optional(),
  })
  .refine((data) => !data.openingTime || !data.closingTime || data.openingTime < data.closingTime, {
    message: "openingTime must be before closingTime",
    path: ["closingTime"],
  });

export const branchIdParamSchema = z.object({
  id: z.string().uuid("Invalid branch id"),
});

export const holidayIdParamSchema = z.object({
  id: z.string().uuid("Invalid branch id"),
  holidayId: z.string().uuid("Invalid holiday id"),
});

export const createHolidaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .refine((val) => !Number.isNaN(Date.parse(val)), "date must be a valid date")
    .refine((val) => new Date(val).getTime() >= Date.now() - 24 * 60 * 60 * 1000, "date must not be in the past"),
  reason: z.string().trim().max(255).optional(),
});

export const capacityRuleSchema = z.object({
  maxCapacityOverride: z.number().int().positive("maxCapacityOverride must be > 0"),
});
