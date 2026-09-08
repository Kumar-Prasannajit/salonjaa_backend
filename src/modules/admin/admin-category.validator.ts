import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase, alphanumeric, hyphen-separated");

export const categoryIdParamSchema = z.object({
  id: z.string().uuid("Invalid category id"),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100),
  slug: slugSchema.optional(),
  icon: z.string().trim().max(500).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  icon: z.string().trim().max(500).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
