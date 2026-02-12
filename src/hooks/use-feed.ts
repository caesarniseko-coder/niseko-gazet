"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

type ContentBlock = {
  type: "text" | "image" | "video" | "embed" | "quote";
  content: string;
  metadata?: Record<string, unknown>;
};

export type FeedItem = {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  topicTags: string[];
  geoTags: string[];
  publishedAt: string;
  isGated: boolean;
  contentBlocks: ContentBlock[];
  authorId: string;
};

type FeedResponse = {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

type FeedFilters = {
  topic?: string;
  geo?: string;
  mutedTopics?: string[];
};

async function fetchFeed(
  cursor: string | null,
  filters: FeedFilters
): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.geo) params.set("geo", filters.geo);
  if (filters.mutedTopics?.length) {
    params.set("mutedTopics", filters.mutedTopics.join(","));
  }

  const res = await fetch(`/api/feed?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

export function useFeed(filters: FeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["feed", filters],
    queryFn: ({ pageParam }) => fetchFeed(pageParam ?? null, filters),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
  });
}
