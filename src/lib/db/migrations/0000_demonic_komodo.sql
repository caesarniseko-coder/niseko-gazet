CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'revision_requested');--> statement-breakpoint
CREATE TYPE "public"."delivery_channel" AS ENUM('feed', 'email', 'push', 'sms', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."delivery_result" AS ENUM('delivered', 'failed', 'bounced', 'suppressed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."field_note_status" AS ENUM('raw', 'processing', 'packaged', 'assigned', 'archived');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."risk_flag_type" AS ENUM('identifiable_private_individual', 'minor_involved', 'allegation_or_crime_accusation', 'ongoing_investigation', 'medical_or_public_health_claim', 'high_defamation_risk', 'graphic_content', 'sensitive_location');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'corrected', 'retracted');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'basic', 'premium', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'journalist', 'moderator', 'subscriber', 'anonymous');--> statement-breakpoint
CREATE TABLE "approval_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"version_hash" varchar(64) NOT NULL,
	"approver_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"notes" text,
	"risk_acknowledgements" jsonb DEFAULT '[]'::jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"version_hash" varchar(64) NOT NULL,
	"channel" "delivery_channel" NOT NULL,
	"result" "delivery_result" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"who" text,
	"what" text NOT NULL,
	"when_occurred" timestamp with time zone,
	"where_location" text,
	"why" text,
	"how" text,
	"quotes" jsonb DEFAULT '[]'::jsonb,
	"contacts" jsonb DEFAULT '[]'::jsonb,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb,
	"confidence_score" integer DEFAULT 0,
	"safety_legal_flags" jsonb DEFAULT '[]'::jsonb,
	"status" "field_note_status" DEFAULT 'raw' NOT NULL,
	"geo_lat" text,
	"geo_lng" text,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"submitter_ip" varchar(45),
	"submitter_email" varchar(255),
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"review_notes" text,
	"related_story_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(512) NOT NULL,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"headline" varchar(512) NOT NULL,
	"summary" text,
	"topic_tags" jsonb DEFAULT '[]'::jsonb,
	"geo_tags" jsonb DEFAULT '[]'::jsonb,
	"author_id" uuid NOT NULL,
	"field_note_id" uuid,
	"current_version_hash" varchar(64),
	"published_at" timestamp with time zone,
	"is_gated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"version_hash" varchar(64) NOT NULL,
	"content_blocks" jsonb NOT NULL,
	"source_log" jsonb DEFAULT '[]'::jsonb,
	"public_sources" jsonb DEFAULT '[]'::jsonb,
	"risk_flags" jsonb DEFAULT '[]'::jsonb,
	"cizer_metadata" jsonb,
	"version_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_versions_version_hash_unique" UNIQUE("version_hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"followed_topics" jsonb DEFAULT '[]'::jsonb,
	"muted_topics" jsonb DEFAULT '[]'::jsonb,
	"followed_geo_areas" jsonb DEFAULT '[]'::jsonb,
	"digest_frequency" varchar(20) DEFAULT 'daily',
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"quiet_hours_timezone" varchar(50) DEFAULT 'Asia/Tokyo',
	"max_notifications_per_day" integer DEFAULT 10,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'subscriber' NOT NULL,
	"avatar_url" text,
	"password_hash" text,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_logs" ADD CONSTRAINT "delivery_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_logs" ADD CONSTRAINT "delivery_logs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_notes" ADD CONSTRAINT "field_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_related_story_id_stories_id_fk" FOREIGN KEY ("related_story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_field_note_id_field_notes_id_fk" FOREIGN KEY ("field_note_id") REFERENCES "public"."field_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_records_story_idx" ON "approval_records" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "approval_records_version_idx" ON "approval_records" USING btree ("version_hash");--> statement-breakpoint
CREATE INDEX "approval_records_approver_idx" ON "approval_records" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "delivery_logs_user_idx" ON "delivery_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_story_idx" ON "delivery_logs" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "delivery_logs_channel_idx" ON "delivery_logs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "field_notes_author_idx" ON "field_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "field_notes_status_idx" ON "field_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_queue_status_idx" ON "moderation_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_queue_type_idx" ON "moderation_queue" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_idx" ON "stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stories_status_idx" ON "stories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stories_author_idx" ON "stories" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "stories_published_idx" ON "stories" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_versions_hash_idx" ON "story_versions" USING btree ("version_hash");--> statement-breakpoint
CREATE INDEX "story_versions_story_idx" ON "story_versions" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");