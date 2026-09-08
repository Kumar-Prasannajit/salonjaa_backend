import { z } from "zod";

export const promotionIdParamSchema = z.object({
  id: z.string().uuid("Invalid promotion id"),
});

export const createPromotionSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(200),
    description: z.string().trim().max(2000).optional(),
    bannerImageUrl: z.string().trim().url().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    branchIds: z.array(z.string().uuid("Invalid branch id")).min(1, "At least one branchId is required"),
    serviceIds: z.array(z.string().uuid("Invalid service id")).optional(),
  })
  .refine((v) => new Date(v.startsAt) < new Date(v.endsAt), { message: "startsAt must be before endsAt", path: ["endsAt"] });

export const updatePromotionSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    bannerImageUrl: z.string().trim().url().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt), {
    message: "startsAt must be before endsAt",
    path: ["endsAt"],
  });
