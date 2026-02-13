import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { auth } from "@/lib/auth/config";
import { hasActiveSubscription } from "@/lib/services/subscriber-service";

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const topic = url.searchParams.get("topic");
  const geo = url.searchParams.get("geo");
  const mutedTopicsParam = url.searchParams.get("mutedTopics");
  const mutedTopics = mutedTopicsParam ? mutedTopicsParam.split(",") : [];

  // Build query: only published stories
  let query = supabase
    .from("stories")
    .select("id, slug, headline, summary, topic_tags, geo_tags, published_at, is_gated, current_version_hash, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  // Cursor-based pagination
  if (cursor) {
    query = query.lt("published_at", cursor);
  }

  const { data: rawResults, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let results = rawResults ?? [];

  // Apply topic filter (post-query since JSONB)
  if (topic) {
    results = results.filter((s) =>
      (s.topic_tags as string[])?.some(
        (t) => t.toLowerCase() === topic.toLowerCase()
      )
    );
  }

  // Apply geo filter
  if (geo) {
    results = results.filter((s) =>
      (s.geo_tags as string[])?.some(
        (g) => g.toLowerCase() === geo.toLowerCase()
      )
    );
  }

  // Exclude muted topics
  if (mutedTopics.length > 0) {
    results = results.filter(
      (s) =>
        !(s.topic_tags as string[])?.some((t) =>
          mutedTopics.includes(t.toLowerCase())
        )
    );
  }

  const hasMore = results.length > PAGE_SIZE;
  const items = hasMore ? results.slice(0, PAGE_SIZE) : results;
  const nextCursor = hasMore
    ? items[items.length - 1]?.published_at
    : null;

  // Fetch content blocks for each story's current version
  const versionHashes = items
    .map((s) => s.current_version_hash)
    .filter(Boolean) as string[];

  let versionMap: Record<string, unknown> = {};
  if (versionHashes.length > 0) {
    const { data: versions } = await supabase
      .from("story_versions")
      .select("version_hash, content_blocks")
      .in("version_hash", versionHashes);

    if (versions) {
      versionMap = Object.fromEntries(
        versions.map((v) => [v.version_hash, v.content_blocks])
      );
    }
  }

  // Check subscription for gated content enforcement
  const session = await auth();
  const isSubscriber = session?.user?.id
    ? await hasActiveSubscription(session.user.id)
    : false;

  // Map to camelCase for frontend consumption
  // Gated stories: strip contentBlocks for non-subscribers (Critical Invariant #6)
  const feedItems = items.map((story) => {
    const gated = story.is_gated && !isSubscriber;
    return {
      id: story.id,
      slug: story.slug,
      headline: story.headline,
      summary: story.summary,
      topicTags: story.topic_tags,
      geoTags: story.geo_tags,
      publishedAt: story.published_at,
      isGated: story.is_gated,
      currentVersionHash: story.current_version_hash,
      authorId: story.author_id,
      contentBlocks: gated
        ? []
        : story.current_version_hash
          ? versionMap[story.current_version_hash] ?? []
          : [],
    };
  });

  return NextResponse.json({
    items: feedItems,
    nextCursor,
    hasMore,
  });
}
