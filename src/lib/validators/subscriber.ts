import { z } from "zod";
import { SUBSCRIPTION_PLANS } from "@/types/enums";

export const updatePreferencesSchema = z.object({
  followedTopics: z.array(z.string()).optional(),
  mutedTopics: z.array(z.string()).optional(),
  followedGeoAreas: z.array(z.string()).optional(),
  digestFrequency: z.enum(["daily", "weekly", "realtime"]).optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
    .optional(),
  quietHoursTimezone: z.string().optional(),
  maxNotificationsPerDay: z.number().int().min(0).max(100).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

export const createSubscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
