import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stories, storyVersions } from "@/lib/db/schema";
import { eq, and, desc, lt, inArray } from "drizzle-orm";

const PAGE_SIZE = 10;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const topic = url.searchParams.get("topic");
  const geo = url.searchParams.get("geo");
  const mutedTopicsParam = url.searchParams.get("mutedTopics");
  const mutedTopics = mutedTopicsParam ? mutedTopicsParam.split(",") : [];

  // Build conditions: only published stories
  const conditions = [eq(stories.status, "published")];

  // Cursor-based pagination
  if (cursor) {
    conditions.push(lt(stories.publishedAt, new Date(cursor)));
  }

  // Fetch stories
  let results = await db
    .select({
      id: stories.id,
      slug: stories.slug,
      headline: stories.headline,
      summary: stories.summary,
      topicTags: stories.topicTags,
      geoTags: stories.geoTags,
      publishedAt: stories.publishedAt,
      isGated: stories.isGated,
      currentVersionHash: stories.currentVersionHash,
      authorId: stories.authorId,
    })
    .from(stories)
    .where(and(...conditions))
    .orderBy(desc(stories.publishedAt))
    .limit(PAGE_SIZE + 1);

  // Apply topic filter (post-query since JSONB)
  if (topic) {
    results = results.filter((s) =>
      (s.topicTags as string[])?.some(
        (t) => t.toLowerCase() === topic.toLowerCase()
      )
    );
  }

  // Apply geo filter
  if (geo) {
    results = results.filter((s) =>
      (s.geoTags as string[])?.some(
        (g) => g.toLowerCase() === geo.toLowerCase()
      )
    );
  }

  // Exclude muted topics
  if (mutedTopics.length > 0) {
    results = results.filter(
      (s) =>
        !(s.topicTags as string[])?.some((t) =>
          mutedTopics.includes(t.toLowerCase())
        )
    );
  }

  const hasMore = results.length > PAGE_SIZE;
  const items = hasMore ? results.slice(0, PAGE_SIZE) : results;
  const nextCursor = hasMore
    ? items[items.length - 1]?.publishedAt?.toISOString()
    : null;

  // Fetch content blocks for each story's current version
  const versionHashes = items
    .map((s) => s.currentVersionHash)
    .filter(Boolean) as string[];

  let versionMap: Record<string, unknown> = {};
  if (versionHashes.length > 0) {
    const versions = await db
      .select({
        versionHash: storyVersions.versionHash,
        contentBlocks: storyVersions.contentBlocks,
      })
      .from(storyVersions)
      .where(inArray(storyVersions.versionHash, versionHashes));

    versionMap = Object.fromEntries(
      versions.map((v) => [v.versionHash, v.contentBlocks])
    );
  }

  const feedItems = items.map((story) => ({
    ...story,
    contentBlocks: story.currentVersionHash
      ? versionMap[story.currentVersionHash] ?? []
      : [],
  }));

  return NextResponse.json({
    items: feedItems,
    nextCursor,
    hasMore,
  });
}
