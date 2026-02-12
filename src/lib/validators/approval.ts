import { z } from "zod";
import { APPROVAL_DECISIONS } from "@/types/enums";

const riskAcknowledgementSchema = z.object({
  flagType: z.string().min(1),
  acknowledged: z.boolean(),
  justification: z.string().min(1, "Justification required for risk acknowledgement"),
});

export const createApprovalSchema = z.object({
  versionHash: z.string().length(64, "Version hash must be 64 characters (SHA-256)"),
  decision: z.enum(APPROVAL_DECISIONS),
  notes: z.string().optional(),
  riskAcknowledgements: z.array(riskAcknowledgementSchema).default([]),
});

export const publishSchema = z.object({
  versionHash: z.string().length(64, "Version hash must be 64 characters (SHA-256)"),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
