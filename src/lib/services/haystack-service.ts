import { supabase } from "@/lib/supabase/server";
import { toCamelCase } from "@/lib/supabase/helpers";

// ── Source Feeds ─────────────────────────────────────

export async function listSourceFeeds() {
  const { data, error } = await supabase
    .from("source_feeds")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list source feeds: ${error.message}`);
  return (data ?? []).map(toCamelCase);
}

export async function createSourceFeed(
  source: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("source_feeds")
    .insert(source)
    .select()
    .single();

  if (error) throw new Error(`Failed to create source feed: ${error.message}`);
  return toCamelCase(data);
}

export async function deleteSourceFeed(id: string) {
  const { error } = await supabase
    .from("source_feeds")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete source feed: ${error.message}`);
}

export async function updateSourceFeed(
  id: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("source_feeds")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update source feed: ${error.message}`);
  return toCamelCase(data);
}

// ── Pipeline Runs ────────────────────────────────────

export async function listPipelineRuns(limit = 50) {
  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list pipeline runs: ${error.message}`);
  return (data ?? []).map(toCamelCase);
}

export async function getPipelineRun(id: string) {
  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Failed to get pipeline run: ${error.message}`);
  return toCamelCase(data);
}

// ── Pipeline Stats ───────────────────────────────────

export async function getPipelineStats() {
  const { data: runs } = await supabase
    .from("pipeline_runs")
    .select("stats, status, started_at")
    .order("started_at", { ascending: false })
    .limit(20);

  const { count: sourceCount } = await supabase
    .from("source_feeds")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: crawlCount } = await supabase
    .from("crawl_history")
    .select("*", { count: "exact", head: true });

  const { count: fieldNoteCount } = await supabase
    .from("field_notes")
    .select("*", { count: "exact", head: true })
    .eq("author_id", "b0000000-0000-0000-0000-000000000001");

  const runRows = runs ?? [];
  const totalArticles = runRows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + ((r.stats as Record<string, number>)?.raw_count ?? 0),
    0
  );
  const totalCreated = runRows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum +
      ((r.stats as Record<string, number>)?.field_notes_created ?? 0),
    0
  );

  return {
    activeSources: sourceCount ?? 0,
    totalCrawled: crawlCount ?? 0,
    totalFieldNotes: fieldNoteCount ?? 0,
    recentRuns: (runs ?? []).length,
    totalArticlesProcessed: totalArticles,
    totalFieldNotesCreated: totalCreated,
  };
}

// ── Analytics ────────────────────────────────────────

export async function getTopicTrends(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("crawl_history")
    .select("classification_data, source_feed_id")
    .eq("was_relevant", true)
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(500);

  if (!data || data.length === 0) return [];

  const topicCounts: Record<string, { count: number; sources: Set<string> }> = {};

  for (const row of data) {
    const classification = row.classification_data as Record<string, unknown> | null;
    const topics = (classification?.topics ?? []) as string[];
    const sourceId = row.source_feed_id as string;

    for (const topic of topics) {
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, sources: new Set() };
      }
      topicCounts[topic].count++;
      topicCounts[topic].sources.add(sourceId);
    }
  }

  return Object.entries(topicCounts)
    .map(([topic, { count, sources }]) => ({
      topic,
      count,
      sourceCount: sources.size,
      trend:
        sources.size >= 3 && count >= 5
          ? "hot"
          : sources.size >= 2 || count >= 4
            ? "rising"
            : "steady",
    }))
    .sort((a, b) => b.count - a.count)
    .filter((t) => t.count >= 2);
}

export async function getSourceAnalytics() {
  // Try with reliability_score first, fall back without it if column doesn't exist yet
  let sources;
  const { data, error } = await supabase
    .from("source_feeds")
    .select(
      "id, name, source_type, reliability_tier, reliability_score, last_fetched_at, consecutive_errors"
    )
    .eq("is_active", true)
    .order("name");

  if (error?.code === "42703") {
    // Column doesn't exist yet (migration 002 pending)
    const { data: fallback } = await supabase
      .from("source_feeds")
      .select(
        "id, name, source_type, reliability_tier, last_fetched_at, consecutive_errors"
      )
      .eq("is_active", true)
      .order("name");
    sources = fallback;
  } else {
    sources = data;
  }

  if (!sources) return [];

  const result = [];
  for (const source of sources) {
    const { data: recent } = await supabase
      .from("crawl_history")
      .select("id, was_relevant, field_note_id")
      .eq("source_feed_id", source.id)
      .order("fetched_at", { ascending: false })
      .limit(50);

    const rows = recent ?? [];
    result.push({
      ...toCamelCase(source),
      recentCrawled: rows.length,
      recentRelevant: rows.filter(
        (r: Record<string, unknown>) => r.was_relevant
      ).length,
      recentPublished: rows.filter(
        (r: Record<string, unknown>) => r.field_note_id
      ).length,
    });
  }

  return result;
}
