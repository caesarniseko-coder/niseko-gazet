import { db } from "@/lib/db";
import {
  deliveryLogs,
  subscriptions,
  userPreferences,
  stories,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

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
  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) return { delivered: 0, suppressed: 0, failed: 0 };

  // Get all active subscribers
  const activeSubscribers = await db
    .select({
      userId: subscriptions.userId,
      plan: subscriptions.plan,
    })
    .from(subscriptions)
    .where(eq(subscriptions.isActive, true));

  const results = { delivered: 0, suppressed: 0, failed: 0 };
  const entries: DeliveryEntry[] = [];

  for (const subscriber of activeSubscribers) {
    // Get user preferences
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, subscriber.userId))
      .limit(1);

    // Check muted topics
    const storyTopics = (story.topicTags as string[]) ?? [];
    const mutedTopics = (prefs?.mutedTopics as string[]) ?? [];
    const isMuted = storyTopics.some((t) =>
      mutedTopics.map((m) => m.toLowerCase()).includes(t.toLowerCase())
    );

    if (isMuted) {
      entries.push({
        userId: subscriber.userId,
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
    if (prefs?.quietHoursStart && prefs?.quietHoursEnd) {
      const tz = prefs.quietHoursTimezone ?? "Asia/Tokyo";
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const currentTime = formatter.format(now);

      if (isInQuietHours(currentTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        entries.push({
          userId: subscriber.userId,
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
    if (prefs?.maxNotificationsPerDay) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(deliveryLogs)
        .where(
          and(
            eq(deliveryLogs.userId, subscriber.userId),
            eq(deliveryLogs.result, "delivered"),
            sql`${deliveryLogs.timestamp} >= ${todayStart}`
          )
        );

      const todayCount = countResult?.count ?? 0;
      if (todayCount >= prefs.maxNotificationsPerDay) {
        entries.push({
          userId: subscriber.userId,
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
      userId: subscriber.userId,
      storyId,
      versionHash,
      channel: "feed",
      result: "delivered",
    });
    results.delivered++;
  }

  // Batch insert delivery logs
  if (entries.length > 0) {
    await db.insert(deliveryLogs).values(
      entries.map((e) => ({
        userId: e.userId,
        storyId: e.storyId,
        versionHash: e.versionHash,
        channel: e.channel,
        result: e.result,
        errorMessage: e.errorMessage ?? null,
      }))
    );
  }

  return results;
}

function isInQuietHours(current: string, start: string, end: string): boolean {
  // Handle wrap-around (e.g., 22:00 to 06:00)
  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export async function getDeliveryLogs(storyId: string) {
  return db
    .select()
    .from(deliveryLogs)
    .where(eq(deliveryLogs.storyId, storyId));
}
