import { z } from "zod";
import { STORY_STATUSES } from "@/types/enums";

const contentBlockSchema = z.object({
  type: z.enum(["text", "image", "video", "embed", "quote"]),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const sourceEntrySchema = z.object({
  source: z.string().min(1),
  verified: z.boolean(),
  notes: z.string(),
});

const riskFlagSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().optional(),
});

export const createStorySchema = z.object({
  headline: z.string().min(1, "Headline is required").max(512),
  summary: z.string().optional(),
  topicTags: z.array(z.string()).default([]),
  geoTags: z.array(z.string()).default([]),
  fieldNoteId: z.string().uuid().optional(),
  isGated: z.boolean().default(false),
});

export const updateStorySchema = createStorySchema.partial().extend({
  status: z.enum(STORY_STATUSES).optional(),
});

export const createStoryVersionSchema = z.object({
  contentBlocks: z.array(contentBlockSchema).min(1, "At least one content block required"),
  sourceLog: z.array(sourceEntrySchema).default([]),
  publicSources: z.array(z.string()).default([]),
  riskFlags: z.array(riskFlagSchema).default([]),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type UpdateStoryInput = z.infer<typeof updateStorySchema>;
export type CreateStoryVersionInput = z.infer<typeof createStoryVersionSchema>;
