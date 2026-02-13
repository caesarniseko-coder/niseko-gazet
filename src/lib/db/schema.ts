import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── ENUMS ──────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "editor",
  "journalist",
  "moderator",
  "subscriber",
  "anonymous",
]);

export const storyStatusEnum = pgEnum("story_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "corrected",
  "retracted",
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
  "revision_requested",
]);

export const deliveryChannelEnum = pgEnum("delivery_channel", [
  "feed",
  "email",
  "push",
  "sms",
  "webhook",
]);

export const deliveryResultEnum = pgEnum("delivery_result", [
  "delivered",
  "failed",
  "bounced",
  "suppressed",
  "pending",
]);

export const riskFlagTypeEnum = pgEnum("risk_flag_type", [
  "identifiable_private_individual",
  "minor_involved",
  "allegation_or_crime_accusation",
  "ongoing_investigation",
  "medical_or_public_health_claim",
  "high_defamation_risk",
  "graphic_content",
  "sensitive_location",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
  "escalated",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "basic",
  "premium",
  "enterprise",
]);

export const fieldNoteStatusEnum = pgEnum("field_note_status", [
  "raw",
  "processing",
  "packaged",
  "assigned",
  "archived",
]);

// ── TYPE HELPERS ───────────────────────────────────────────

export type Quote = { speaker: string; text: string; context: string };
export type Contact = {
  name: string;
  role: string;
  phone?: string;
  email?: string;
};
export type EvidenceRef = { type: string; url: string; description: string };
export type ContentBlock = {
  type: "text" | "image" | "video" | "embed" | "quote";
  content: string;
  metadata?: Record<string, unknown>;
};
export type SourceEntry = {
  source: string;
  verified: boolean;
  notes: string;
};
export type RiskFlag = {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
  acknowledgedBy?: string;
  acknowledgedAt?: string;
};
export type RiskAcknowledgement = {
  flagType: string;
  acknowledged: boolean;
  justification: string;
};

// ── USERS ──────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("subscriber"),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

// ── FIELD NOTES ────────────────────────────────────────────

export const fieldNotes = pgTable(
  "field_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    who: text("who"),
    what: text("what").notNull(),
    whenOccurred: timestamp("when_occurred", { withTimezone: true }),
    whereLocation: text("where_location"),
    why: text("why"),
    how: text("how"),
    quotes: jsonb("quotes").$type<Quote[]>().default([]),
    contacts: jsonb("contacts").$type<Contact[]>().default([]),
    evidenceRefs: jsonb("evidence_refs").$type<EvidenceRef[]>().default([]),
    confidenceScore: integer("confidence_score").default(0),
    safetyLegalFlags: jsonb("safety_legal_flags")
      .$type<string[]>()
      .default([]),
    status: fieldNoteStatusEnum("status").notNull().default("raw"),
    geoLat: text("geo_lat"),
    geoLng: text("geo_lng"),
    rawText: text("raw_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("field_notes_author_idx").on(table.authorId),
    index("field_notes_status_idx").on(table.status),
  ]
);

// ── STORIES ────────────────────────────────────────────────

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 512 }).notNull().unique(),
    status: storyStatusEnum("status").notNull().default("draft"),
    headline: varchar("headline", { length: 512 }).notNull(),
    summary: text("summary"),
    topicTags: jsonb("topic_tags").$type<string[]>().default([]),
    geoTags: jsonb("geo_tags").$type<string[]>().default([]),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    fieldNoteId: uuid("field_note_id").references(() => fieldNotes.id),
    currentVersionHash: varchar("current_version_hash", { length: 64 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isGated: boolean("is_gated").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stories_slug_idx").on(table.slug),
    index("stories_status_idx").on(table.status),
    index("stories_author_idx").on(table.authorId),
    index("stories_published_idx").on(table.publishedAt),
  ]
);

// ── STORY VERSIONS (immutable once approved) ───────────────

export const storyVersions = pgTable(
  "story_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id),
    versionHash: varchar("version_hash", { length: 64 }).notNull().unique(),
    contentBlocks: jsonb("content_blocks")
      .$type<ContentBlock[]>()
      .notNull(),
    sourceLog: jsonb("source_log").$type<SourceEntry[]>().default([]),
    publicSources: jsonb("public_sources").$type<string[]>().default([]),
    riskFlags: jsonb("risk_flags").$type<RiskFlag[]>().default([]),
    cizerMetadata: jsonb("cizer_metadata").$type<{
      modelVersion: string;
      editSuggestions: string[];
      factCheckResults: Record<string, unknown>[];
      processingTime: number;
    }>(),
    versionNumber: integer("version_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("story_versions_hash_idx").on(table.versionHash),
    index("story_versions_story_idx").on(table.storyId),
  ]
);

// ── APPROVAL RECORDS ───────────────────────────────────────

export const approvalRecords = pgTable(
  "approval_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id),
    versionHash: varchar("version_hash", { length: 64 }).notNull(),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    decision: approvalDecisionEnum("decision").notNull(),
    notes: text("notes"),
    riskAcknowledgements: jsonb("risk_acknowledgements")
      .$type<RiskAcknowledgement[]>()
      .default([]),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("approval_records_story_idx").on(table.storyId),
    index("approval_records_version_idx").on(table.versionHash),
    index("approval_records_approver_idx").on(table.approverId),
  ]
);

// ── DELIVERY LOGS ──────────────────────────────────────────

export const deliveryLogs = pgTable(
  "delivery_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id),
    versionHash: varchar("version_hash", { length: 64 }).notNull(),
    channel: deliveryChannelEnum("channel").notNull(),
    result: deliveryResultEnum("result").notNull().default("pending"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("delivery_logs_user_idx").on(table.userId),
    index("delivery_logs_story_idx").on(table.storyId),
    index("delivery_logs_channel_idx").on(table.channel),
  ]
);

// ── SUBSCRIPTIONS ──────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  plan: subscriptionPlanEnum("plan").notNull().default("free"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── USER PREFERENCES ───────────────────────────────────────

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  followedTopics: jsonb("followed_topics").$type<string[]>().default([]),
  mutedTopics: jsonb("muted_topics").$type<string[]>().default([]),
  followedGeoAreas: jsonb("followed_geo_areas").$type<string[]>().default([]),
  digestFrequency: varchar("digest_frequency", { length: 20 }).default(
    "daily"
  ),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
  quietHoursTimezone: varchar("quiet_hours_timezone", { length: 50 }).default(
    "Asia/Tokyo"
  ),
  maxNotificationsPerDay: integer("max_notifications_per_day").default(10),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── MODERATION QUEUE ───────────────────────────────────────

export const moderationQueue = pgTable(
  "moderation_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 50 }).notNull(),
    content: text("content").notNull(),
    submitterIp: varchar("submitter_ip", { length: 45 }),
    submitterEmail: varchar("submitter_email", { length: 255 }),
    status: moderationStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewNotes: text("review_notes"),
    relatedStoryId: uuid("related_story_id").references(() => stories.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("moderation_queue_status_idx").on(table.status),
    index("moderation_queue_type_idx").on(table.type),
  ]
);

// ── HAYSTACK: SOURCE FEEDS ────────────────────────────────

export const sourceTypeEnum = pgEnum("source_type", [
  "rss",
  "scrape",
  "api",
  "social",
  "tip",
]);

export const reliabilityTierEnum = pgEnum("reliability_tier", [
  "official",
  "standard",
  "yellow_press",
]);

export const sourceFeeds = pgTable(
  "source_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    url: text("url").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    pollIntervalMinutes: integer("poll_interval_minutes").default(15),
    isActive: boolean("is_active").default(true),
    reliabilityTier: reliabilityTierEnum("reliability_tier")
      .notNull()
      .default("standard"),
    defaultTopics: jsonb("default_topics").$type<string[]>().default([]),
    defaultGeoTags: jsonb("default_geo_tags").$type<string[]>().default([]),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    reliabilityScore: real("reliability_score").default(50.0),
    consecutiveErrors: integer("consecutive_errors").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("source_feeds_type_idx").on(table.sourceType),
    index("source_feeds_active_idx").on(table.isActive),
  ]
);

// ── HAYSTACK: CRAWL HISTORY ──────────────────────────────

export const crawlHistory = pgTable(
  "crawl_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceFeedId: uuid("source_feed_id")
      .notNull()
      .references(() => sourceFeeds.id),
    sourceUrl: text("source_url").notNull(),
    contentFingerprint: varchar("content_fingerprint", { length: 32 })
      .notNull(),
    pipelineRunId: uuid("pipeline_run_id"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
    status: varchar("status", { length: 20 }).notNull().default("processed"),
    relevanceScore: jsonb("relevance_score").$type<number>(),
    wasRelevant: boolean("was_relevant").default(false),
    wasDuplicate: boolean("was_duplicate").default(false),
    classificationData: jsonb("classification_data").$type<
      Record<string, unknown>
    >(),
    fieldNoteId: uuid("field_note_id").references(() => fieldNotes.id),
    moderationItemId: uuid("moderation_item_id"),
    errorMessage: text("error_message"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("crawl_history_fingerprint_idx").on(table.contentFingerprint),
    index("crawl_history_source_url_idx").on(table.sourceUrl),
    index("crawl_history_run_idx").on(table.pipelineRunId),
    index("crawl_history_source_feed_idx").on(table.sourceFeedId),
  ]
);

// ── HAYSTACK: PIPELINE RUNS ─────────────────────────────

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runType: varchar("run_type", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    stats: jsonb("stats").$type<Record<string, unknown>>().default({}),
    errors: jsonb("errors").$type<Record<string, unknown>[]>().default([]),
    sourcesPolled: jsonb("sources_polled").$type<string[]>().default([]),
  },
  (table) => [
    index("pipeline_runs_status_idx").on(table.status),
    index("pipeline_runs_started_idx").on(table.startedAt),
  ]
);

// ── AUDIT LOGS ─────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }).notNull(),
    changes: jsonb("changes"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_logs_timestamp_idx").on(table.timestamp),
  ]
);
