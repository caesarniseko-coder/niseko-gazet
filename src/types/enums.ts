export const USER_ROLES = [
  "admin",
  "editor",
  "journalist",
  "moderator",
  "subscriber",
  "anonymous",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STORY_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
  "corrected",
  "retracted",
] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const APPROVAL_DECISIONS = [
  "approved",
  "rejected",
  "revision_requested",
] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const DELIVERY_CHANNELS = [
  "feed",
  "email",
  "push",
  "sms",
  "webhook",
] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_RESULTS = [
  "delivered",
  "failed",
  "bounced",
  "suppressed",
  "pending",
] as const;
export type DeliveryResult = (typeof DELIVERY_RESULTS)[number];

export const RISK_FLAG_TYPES = [
  "identifiable_private_individual",
  "minor_involved",
  "allegation_or_crime_accusation",
  "ongoing_investigation",
  "medical_or_public_health_claim",
  "high_defamation_risk",
  "graphic_content",
  "sensitive_location",
] as const;
export type RiskFlagType = (typeof RISK_FLAG_TYPES)[number];

export const MODERATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "escalated",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const SUBSCRIPTION_PLANS = [
  "free",
  "basic",
  "premium",
  "enterprise",
] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const FIELD_NOTE_STATUSES = [
  "raw",
  "processing",
  "packaged",
  "assigned",
  "archived",
] as const;
export type FieldNoteStatus = (typeof FIELD_NOTE_STATUSES)[number];
