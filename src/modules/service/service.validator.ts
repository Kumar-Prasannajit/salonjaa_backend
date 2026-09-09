import { z } from "zod";

export const createServiceSchema = z.object({
  branchId: z.string().uuid("Invalid branch id"),
  categoryId: z.string().uuid("Invalid category id"),
  name: z.string().trim().min(1).max(200),
  durationMinutes: z.number().int().positive("durationMinutes must be > 0"),
  basePrice: z.number().positive("basePrice must be > 0"),
});

export const updateServiceSchema = z.object({
  categoryId: z.string().uuid("Invalid category id").optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.number().int().positive().optional(),
  basePrice: z.number().positive().optional(),
  imageUrl: z.string().trim().url().optional(),
});

export const serviceIdParamSchema = z.object({
  id: z.string().uuid("Invalid service id"),
});

export const serviceStaffParamSchema = z.object({
  id: z.string().uuid("Invalid service id"),
  staffId: z.string().uuid("Invalid staff id"),
});

export const serviceListQuerySchema = z.object({
  branchId: z.string().uuid("Invalid branch id").optional(),
});

export const assignStaffSchema = z.object({
  staffId: z.string().uuid("Invalid staff id"),
});

// ---- Module 22: service variants ----

export const createVariantSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  price: z.number().positive("price must be > 0"),
});

export const updateVariantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  price: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const serviceVariantParamSchema = z.object({
  id: z.string().uuid("Invalid service id"),
  variantId: z.string().uuid("Invalid variant id"),
});
