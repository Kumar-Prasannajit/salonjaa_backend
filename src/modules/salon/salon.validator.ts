import { z } from "zod";

export const createSalonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  businessName: z.string().trim().max(200).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  panNumber: z.string().trim().max(20).optional(),
});

export const updateSalonSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  logo: z.string().trim().url().optional(),
  coverImage: z.string().trim().url().optional(),
});

export const salonIdParamSchema = z.object({
  salonId: z.string().uuid("Invalid salon id"),
});
