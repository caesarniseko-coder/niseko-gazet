import { z } from "zod";
import { FIELD_NOTE_STATUSES, RISK_FLAG_TYPES } from "@/types/enums";

const quoteSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  context: z.string(),
});

const contactSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const evidenceRefSchema = z.object({
  type: z.string().min(1),
  url: z.string().url(),
  description: z.string(),
});

export const createFieldNoteSchema = z.object({
  who: z.string().optional(),
  what: z.string().min(1, "What happened is required"),
  whenOccurred: z.string().datetime().optional(),
  whereLocation: z.string().optional(),
  why: z.string().optional(),
  how: z.string().optional(),
  quotes: z.array(quoteSchema).default([]),
  contacts: z.array(contactSchema).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([]),
  confidenceScore: z.number().int().min(0).max(100).default(0),
  safetyLegalFlags: z
    .array(z.enum(RISK_FLAG_TYPES))
    .default([]),
  geoLat: z.string().optional(),
  geoLng: z.string().optional(),
  rawText: z.string().optional(),
});

export const updateFieldNoteSchema = createFieldNoteSchema.partial().extend({
  status: z.enum(FIELD_NOTE_STATUSES).optional(),
});

export type CreateFieldNoteInput = z.infer<typeof createFieldNoteSchema>;
export type UpdateFieldNoteInput = z.infer<typeof updateFieldNoteSchema>;
