import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((val) => !Number.isNaN(Date.parse(val)), "must be a valid date");

export const reportOverviewQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
