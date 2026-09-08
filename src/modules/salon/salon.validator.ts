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

export const galleryImageIdParamSchema = z.object({
  salonId: z.string().uuid("Invalid salon id"),
  imageId: z.string().uuid("Invalid image id"),
});

export const addGalleryImageSchema = z.object({
  imageUrl: z.string().trim().url("imageUrl must be a valid URL"),
  displayOrder: z.number().int().nonnegative().optional(),
});

export const analyticsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
});
