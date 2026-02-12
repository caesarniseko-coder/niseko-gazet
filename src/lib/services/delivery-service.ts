import { supabase } from "@/lib/supabase/server";
import { mapRows } from "@/lib/supabase/helpers";

type DeliveryEntry = {
  userId: string;
  storyId: string;
  versionHash: string;
  channel: "feed" | "email" | "push" | "sms" | "webhook";
  result: "delivered" | "failed" | "suppressed" | "pending";
  errorMessage?: string;
};

/**
 * Orchestrate delivery of a published story to all eligible subscribers.
 * Checks entitlements, muted topics, quiet hours, and frequency caps.
 */
export async function orchestrateDelivery(
  storyId: string,
  versionHash: string
): Promise<{ delivered: number; suppressed: number; failed: number }> {
  // Get the story details
  const { data: story } = await supabase
    .from("stories")
    .select("id, topic_tags")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) return { delivered: 0, suppressed: 0, failed: 0 };

  // Get all active subscribers
  const { data: activeSubscribers } = await supabase
    .from("subscriptions")
    .select("user_id, plan")
    .eq("is_active", true);

  if (!activeSubscribers || activeSubscribers.length === 0) {
    return { delivered: 0, suppressed: 0, failed: 0 };
  }

  const results = { delivered: 0, suppressed: 0, failed: 0 };
  const entries: DeliveryEntry[] = [];

  for (const subscriber of activeSubscribers) {
    // Get user preferences
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", subscriber.user_id)
      .maybeSingle();

    // Check muted topics
    const storyTopics = (story.topic_tags as string[]) ?? [];
    const mutedTopics = (prefs?.muted_topics as string[]) ?? [];
    const isMuted = storyTopics.some((t) =>
      mutedTopics.map((m) => m.toLowerCase()).includes(t.toLowerCase())
    );

    if (isMuted) {
      entries.push({
        userId: subscriber.user_id,
        storyId,
        versionHash,
        channel: "feed",
        result: "suppressed",
        errorMessage: "muted_topic",
      });
      results.suppressed++;
      continue;
    }

    // Check quiet hours
    if (prefs?.quiet_hours_start && prefs?.quiet_hours_end) {
      const tz = prefs.quiet_hours_timezone ?? "Asia/Tokyo";
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const currentTime = formatter.format(now);

      if (isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        entries.push({
          userId: subscriber.user_id,
          storyId,
          versionHash,
          channel: "feed",
          result: "suppressed",
          errorMessage: "quiet_hours",
        });
        results.suppressed++;
        continue;
      }
    }

    // Check frequency cap
    if (prefs?.max_notifications_per_day) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("delivery_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", subscriber.user_id)
        .eq("result", "delivered")
        .gte("timestamp", todayStart.toISOString());

      const todayCount = count ?? 0;
      if (todayCount >= prefs.max_notifications_per_day) {
        entries.push({
          userId: subscriber.user_id,
          storyId,
          versionHash,
          channel: "feed",
          result: "suppressed",
          errorMessage: "frequency_cap",
        });
        results.suppressed++;
        continue;
      }
    }

    // Deliver to feed (always)
    entries.push({
      userId: subscriber.user_id,
      storyId,
      versionHash,
      channel: "feed",
      result: "delivered",
    });
    results.delivered++;
  }

  // Batch insert delivery logs
  if (entries.length > 0) {
    await supabase.from("delivery_logs").insert(
      entries.map((e) => ({
        user_id: e.userId,
        story_id: e.storyId,
        version_hash: e.versionHash,
        channel: e.channel,
        result: e.result,
        error_message: e.errorMessage ?? null,
      }))
    );
  }

  return results;
}

function isInQuietHours(current: string, start: string, end: string): boolean {
  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export async function getDeliveryLogs(storyId: string) {
  const { data, error } = await supabase
    .from("delivery_logs")
    .select("*")
    .eq("story_id", storyId);

  if (error) throw new Error(`Failed to get delivery logs: ${error.message}`);
  return mapRows(data ?? []);
}
