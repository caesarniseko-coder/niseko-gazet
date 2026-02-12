import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  fieldNotes,
  stories,
  storyVersions,
  approvalRecords,
  deliveryLogs,
  subscriptions,
  userPreferences,
  moderationQueue,
  auditLogs,
} from "@/lib/db/schema";

// Select types (what you get when reading from DB)
export type User = InferSelectModel<typeof users>;
export type FieldNote = InferSelectModel<typeof fieldNotes>;
export type Story = InferSelectModel<typeof stories>;
export type StoryVersion = InferSelectModel<typeof storyVersions>;
export type ApprovalRecord = InferSelectModel<typeof approvalRecords>;
export type DeliveryLog = InferSelectModel<typeof deliveryLogs>;
export type Subscription = InferSelectModel<typeof subscriptions>;
export type UserPreference = InferSelectModel<typeof userPreferences>;
export type ModerationItem = InferSelectModel<typeof moderationQueue>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

// Insert types (what you provide when inserting)
export type NewUser = InferInsertModel<typeof users>;
export type NewFieldNote = InferInsertModel<typeof fieldNotes>;
export type NewStory = InferInsertModel<typeof stories>;
export type NewStoryVersion = InferInsertModel<typeof storyVersions>;
export type NewApprovalRecord = InferInsertModel<typeof approvalRecords>;
export type NewDeliveryLog = InferInsertModel<typeof deliveryLogs>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type NewUserPreference = InferInsertModel<typeof userPreferences>;
export type NewModerationItem = InferInsertModel<typeof moderationQueue>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

export * from "./enums";
