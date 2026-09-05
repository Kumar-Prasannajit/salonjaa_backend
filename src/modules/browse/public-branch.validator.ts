import { z } from "zod";

export const branchSearchQuerySchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    serviceCategoryId: z.string().uuid("Invalid serviceCategoryId").optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    sort: z.enum(["distance", "rating", "popular"]).optional(),
  })
  .refine(
    (val) => {
      if ((val.lat === undefined) !== (val.lng === undefined)) return false;
      if (val.sort === "distance" && val.lat === undefined) return false;
      return true;
    },
    { message: "lat and lng must be supplied together, and are required when sort=distance" }
  );

export const branchIdParamSchema = z.object({
  branchId: z.string().uuid("Invalid branch id"),
});
