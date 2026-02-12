import { db } from "@/lib/db";
import {
  stories,
  storyVersions,
  approvalRecords,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { generateVersionHash } from "@/lib/utils/version-hash";
import { uniqueSlug } from "@/lib/utils/slug";
import type { CreateStoryInput, UpdateStoryInput, CreateStoryVersionInput } from "@/lib/validators/story";
import type { CreateApprovalInput, PublishInput } from "@/lib/validators/approval";

// ── Story CRUD ─────────────────────────────────────────

export async function createStory(authorId: string, input: CreateStoryInput) {
  const slug = uniqueSlug(input.headline);

  const [story] = await db
    .insert(stories)
    .values({
      slug,
      headline: input.headline,
      summary: input.summary ?? null,
      topicTags: input.topicTags,
      geoTags: input.geoTags,
      authorId,
      fieldNoteId: input.fieldNoteId ?? null,
      isGated: input.isGated,
    })
    .returning();

  return story;
}

export async function getStory(id: string) {
  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);

  return story ?? null;
}

export async function listStories(filters?: {
  status?: string;
  authorId?: string;
}) {
  let query = db.select().from(stories).$dynamic();

  if (filters?.status) {
    query = query.where(eq(stories.status, filters.status as "draft" | "in_review" | "approved" | "published" | "corrected" | "retracted"));
  }
  if (filters?.authorId) {
    query = query.where(eq(stories.authorId, filters.authorId));
  }

  return query.orderBy(desc(stories.createdAt));
}

export async function updateStory(id: string, input: UpdateStoryInput) {
  const [existing] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(stories)
    .set({
      ...(input.headline !== undefined && { headline: input.headline }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.topicTags !== undefined && { topicTags: input.topicTags }),
      ...(input.geoTags !== undefined && { geoTags: input.geoTags }),
      ...(input.isGated !== undefined && { isGated: input.isGated }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date(),
    })
    .where(eq(stories.id, id))
    .returning();

  return updated;
}

// ── Story Versions ─────────────────────────────────────

export async function createStoryVersion(
  storyId: string,
  input: CreateStoryVersionInput
) {
  const story = await getStory(storyId);
  if (!story) return { error: "story_not_found" as const };

  // Calculate the version hash
  const versionHash = generateVersionHash(
    input.contentBlocks,
    input.sourceLog,
    input.riskFlags
  );

  // Get the next version number
  const [latest] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${storyVersions.versionNumber}), 0)` })
    .from(storyVersions)
    .where(eq(storyVersions.storyId, storyId));

  const versionNumber = (latest?.maxVersion ?? 0) + 1;

  const [version] = await db
    .insert(storyVersions)
    .values({
      storyId,
      versionHash,
      contentBlocks: input.contentBlocks,
      sourceLog: input.sourceLog,
      publicSources: input.publicSources,
      riskFlags: input.riskFlags,
      versionNumber,
    })
    .returning();

  // Update story's current version hash
  await db
    .update(stories)
    .set({ currentVersionHash: versionHash, updatedAt: new Date() })
    .where(eq(stories.id, storyId));

  return { version };
}

export async function getStoryVersion(storyId: string, versionHash: string) {
  const [version] = await db
    .select()
    .from(storyVersions)
    .where(
      and(
        eq(storyVersions.storyId, storyId),
        eq(storyVersions.versionHash, versionHash)
      )
    )
    .limit(1);

  return version ?? null;
}

export async function listStoryVersions(storyId: string) {
  return db
    .select()
    .from(storyVersions)
    .where(eq(storyVersions.storyId, storyId))
    .orderBy(desc(storyVersions.versionNumber));
}

// ── Approval ───────────────────────────────────────────

export async function createApproval(
  storyId: string,
  approverId: string,
  input: CreateApprovalInput
) {
  // Verify the version exists
  const version = await getStoryVersion(storyId, input.versionHash);
  if (!version) return { error: "version_not_found" as const };

  // Check if version is already approved (immutability check)
  const [existingApproval] = await db
    .select()
    .from(approvalRecords)
    .where(
      and(
        eq(approvalRecords.storyId, storyId),
        eq(approvalRecords.versionHash, input.versionHash),
        eq(approvalRecords.decision, "approved")
      )
    )
    .limit(1);

  if (existingApproval) {
    return { error: "already_approved" as const };
  }

  const [record] = await db
    .insert(approvalRecords)
    .values({
      storyId,
      versionHash: input.versionHash,
      approverId,
      decision: input.decision,
      notes: input.notes ?? null,
      riskAcknowledgements: input.riskAcknowledgements,
    })
    .returning();

  // Update story status based on decision
  if (input.decision === "approved") {
    await db
      .update(stories)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  } else if (input.decision === "revision_requested") {
    await db
      .update(stories)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  }

  return { record };
}

// ── Publishing (THE GATE) ──────────────────────────────

export type PublishError =
  | { type: "story_not_found" }
  | { type: "version_not_found" }
  | { type: "no_approval"; message: string }
  | { type: "hash_mismatch"; expected: string; provided: string }
  | { type: "unacknowledged_risk_flags"; flags: string[] };

export type PublishResult =
  | { success: true; story: typeof stories.$inferSelect }
  | { success: false; error: PublishError };

export async function publishStory(
  storyId: string,
  input: PublishInput
): Promise<PublishResult> {
  const story = await getStory(storyId);
  if (!story) {
    return { success: false, error: { type: "story_not_found" } };
  }

  // Verify version hash matches current version
  if (story.currentVersionHash !== input.versionHash) {
    return {
      success: false,
      error: {
        type: "hash_mismatch",
        expected: story.currentVersionHash ?? "none",
        provided: input.versionHash,
      },
    };
  }

  // Get the version
  const version = await getStoryVersion(storyId, input.versionHash);
  if (!version) {
    return { success: false, error: { type: "version_not_found" } };
  }

  // CRITICAL INVARIANT: Verify ApprovalRecord exists for this exact versionHash
  const [approval] = await db
    .select()
    .from(approvalRecords)
    .where(
      and(
        eq(approvalRecords.storyId, storyId),
        eq(approvalRecords.versionHash, input.versionHash),
        eq(approvalRecords.decision, "approved")
      )
    )
    .limit(1);

  if (!approval) {
    return {
      success: false,
      error: {
        type: "no_approval",
        message: "No approved ApprovalRecord found for this version hash",
      },
    };
  }

  // Check risk flags: all must be acknowledged
  const riskFlags = (version.riskFlags ?? []) as { type: string }[];
  if (riskFlags.length > 0) {
    const acknowledgements = (approval.riskAcknowledgements ?? []) as {
      flagType: string;
      acknowledged: boolean;
    }[];
    const acknowledgedTypes = new Set(
      acknowledgements
        .filter((a) => a.acknowledged)
        .map((a) => a.flagType)
    );

    const unacknowledged = riskFlags
      .map((f) => f.type)
      .filter((t) => !acknowledgedTypes.has(t));

    if (unacknowledged.length > 0) {
      return {
        success: false,
        error: {
          type: "unacknowledged_risk_flags",
          flags: unacknowledged,
        },
      };
    }
  }

  // All checks passed — publish
  const [published] = await db
    .update(stories)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stories.id, storyId))
    .returning();

  return { success: true, story: published };
}
