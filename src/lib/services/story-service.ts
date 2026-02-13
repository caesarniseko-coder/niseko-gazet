import { supabase } from "@/lib/supabase/server";
import { toCamelCase, mapRows } from "@/lib/supabase/helpers";
import { generateVersionHash } from "@/lib/utils/version-hash";
import { uniqueSlug } from "@/lib/utils/slug";
import type { CreateStoryInput, UpdateStoryInput, CreateStoryVersionInput } from "@/lib/validators/story";
import type { CreateApprovalInput, PublishInput } from "@/lib/validators/approval";
import { orchestrateDelivery } from "./delivery-service";

// ── Story CRUD ─────────────────────────────────────────

export async function createStory(authorId: string, input: CreateStoryInput) {
  const slug = uniqueSlug(input.headline);

  const { data, error } = await supabase
    .from("stories")
    .insert({
      slug,
      headline: input.headline,
      summary: input.summary ?? null,
      topic_tags: input.topicTags,
      geo_tags: input.geoTags,
      author_id: authorId,
      field_note_id: input.fieldNoteId ?? null,
      is_gated: input.isGated,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create story: ${error.message}`);
  return toCamelCase(data);
}

export async function getStory(id: string) {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get story: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function listStories(filters?: {
  status?: string;
  authorId?: string;
}) {
  let query = supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.authorId) {
    query = query.eq("author_id", filters.authorId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list stories: ${error.message}`);
  return mapRows(data ?? []);
}

export async function updateStory(id: string, input: UpdateStoryInput) {
  // Check exists
  const { data: existing } = await supabase
    .from("stories")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return null;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.headline !== undefined) updateData.headline = input.headline;
  if (input.summary !== undefined) updateData.summary = input.summary;
  if (input.topicTags !== undefined) updateData.topic_tags = input.topicTags;
  if (input.geoTags !== undefined) updateData.geo_tags = input.geoTags;
  if (input.isGated !== undefined) updateData.is_gated = input.isGated;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from("stories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update story: ${error.message}`);
  return toCamelCase(data);
}

// ── Story Versions ─────────────────────────────────────

export async function createStoryVersion(
  storyId: string,
  input: CreateStoryVersionInput
) {
  const story = await getStory(storyId);
  if (!story) return { error: "story_not_found" as const };

  const versionHash = generateVersionHash(
    input.contentBlocks,
    input.sourceLog,
    input.riskFlags
  );

  // Get the next version number (order by version_number desc, take first)
  const { data: latestVersion } = await supabase
    .from("story_versions")
    .select("version_number")
    .eq("story_id", storyId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (latestVersion?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("story_versions")
    .insert({
      story_id: storyId,
      version_hash: versionHash,
      content_blocks: input.contentBlocks,
      source_log: input.sourceLog,
      public_sources: input.publicSources,
      risk_flags: input.riskFlags,
      version_number: versionNumber,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create story version: ${error.message}`);

  // Update story's current version hash
  await supabase
    .from("stories")
    .update({ current_version_hash: versionHash, updated_at: new Date().toISOString() })
    .eq("id", storyId);

  return { version: toCamelCase(version) };
}

export async function getStoryVersion(storyId: string, versionHash: string) {
  const { data, error } = await supabase
    .from("story_versions")
    .select("*")
    .eq("story_id", storyId)
    .eq("version_hash", versionHash)
    .maybeSingle();

  if (error) throw new Error(`Failed to get story version: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function listStoryVersions(storyId: string) {
  const { data, error } = await supabase
    .from("story_versions")
    .select("*")
    .eq("story_id", storyId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(`Failed to list story versions: ${error.message}`);
  return mapRows(data ?? []);
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
  const { data: existingApproval } = await supabase
    .from("approval_records")
    .select("id")
    .eq("story_id", storyId)
    .eq("version_hash", input.versionHash)
    .eq("decision", "approved")
    .maybeSingle();

  if (existingApproval) {
    return { error: "already_approved" as const };
  }

  const { data: record, error } = await supabase
    .from("approval_records")
    .insert({
      story_id: storyId,
      version_hash: input.versionHash,
      approver_id: approverId,
      decision: input.decision,
      notes: input.notes ?? null,
      risk_acknowledgements: input.riskAcknowledgements,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create approval: ${error.message}`);

  // Update story status based on decision
  if (input.decision === "approved") {
    await supabase
      .from("stories")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", storyId);
  } else if (input.decision === "revision_requested") {
    await supabase
      .from("stories")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", storyId);
  }

  return { record: toCamelCase(record) };
}

// ── Publishing (THE GATE) ──────────────────────────────

export type PublishError =
  | { type: "story_not_found" }
  | { type: "version_not_found" }
  | { type: "no_approval"; message: string }
  | { type: "hash_mismatch"; expected: string; provided: string }
  | { type: "unacknowledged_risk_flags"; flags: string[] };

export type PublishResult =
  | { success: true; story: Record<string, unknown> }
  | { success: false; error: PublishError };

export async function publishStory(
  storyId: string,
  input: PublishInput
): Promise<PublishResult> {
  const story = await getStory(storyId) as Record<string, unknown> | null;
  if (!story) {
    return { success: false, error: { type: "story_not_found" } };
  }

  // Verify version hash matches current version
  if (story.currentVersionHash !== input.versionHash) {
    return {
      success: false,
      error: {
        type: "hash_mismatch",
        expected: (story.currentVersionHash as string) ?? "none",
        provided: input.versionHash,
      },
    };
  }

  // Get the version
  const version = await getStoryVersion(storyId, input.versionHash) as Record<string, unknown> | null;
  if (!version) {
    return { success: false, error: { type: "version_not_found" } };
  }

  // CRITICAL INVARIANT: Verify ApprovalRecord exists for this exact versionHash
  const { data: approval } = await supabase
    .from("approval_records")
    .select("*")
    .eq("story_id", storyId)
    .eq("version_hash", input.versionHash)
    .eq("decision", "approved")
    .maybeSingle();

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
    const acknowledgements = (approval.risk_acknowledgements ?? []) as {
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
  const { data: published, error } = await supabase
    .from("stories")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", storyId)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish story: ${error.message}`);

  // Orchestrate delivery to subscribers (fire-and-forget — don't block publish response)
  orchestrateDelivery(storyId, input.versionHash).catch(() => {
    // Delivery failures are logged in delivery_logs, not surfaced to publisher
  });

  return { success: true, story: toCamelCase(published) };
}
