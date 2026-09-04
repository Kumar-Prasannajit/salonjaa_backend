import { z } from "zod";

export const complaintIdParamSchema = z.object({
  id: z.string().uuid("Invalid complaint id"),
});

export const listComplaintsQuerySchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]).optional(),
});

export const resolveComplaintSchema = z.object({
  resolutionNotes: z.string().trim().min(1, "resolutionNotes is required").max(2000),
});

export const rejectComplaintSchema = z.object({
  reason: z.string().trim().min(1, "reason is required").max(500),
});
