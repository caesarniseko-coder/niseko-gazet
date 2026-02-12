import { db } from "@/lib/db";
import {
  subscriptions,
  userPreferences,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UpdatePreferencesInput, CreateSubscriptionInput } from "@/lib/validators/subscriber";

// ── Subscriptions ──────────────────────────────────────

export async function getSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return sub ?? null;
}

export async function createSubscription(
  userId: string,
  input: CreateSubscriptionInput
) {
  const existing = await getSubscription(userId);
  if (existing) {
    // Update existing subscription
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: input.plan,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();
    return updated;
  }

  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId,
      plan: input.plan,
      isActive: true,
    })
    .returning();

  return sub;
}

export async function cancelSubscription(userId: string) {
  const [updated] = await db
    .update(subscriptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscriptions.userId, userId))
    .returning();

  return updated ?? null;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (!sub || !sub.isActive) return false;
  if (sub.expiresAt && sub.expiresAt < new Date()) return false;
  return true;
}

export async function hasEntitlement(
  userId: string,
  requiredPlan: string
): Promise<boolean> {
  const sub = await getSubscription(userId);
  if (!sub || !sub.isActive) return false;

  const planHierarchy: Record<string, number> = {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3,
  };

  return (planHierarchy[sub.plan] ?? 0) >= (planHierarchy[requiredPlan] ?? 0);
}

// ── User Preferences ───────────────────────────────────

export async function getPreferences(userId: string) {
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return prefs ?? null;
}

export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput
) {
  const existing = await getPreferences(userId);

  if (existing) {
    const [updated] = await db
      .update(userPreferences)
      .set({
        ...(input.followedTopics !== undefined && {
          followedTopics: input.followedTopics,
        }),
        ...(input.mutedTopics !== undefined && {
          mutedTopics: input.mutedTopics,
        }),
        ...(input.followedGeoAreas !== undefined && {
          followedGeoAreas: input.followedGeoAreas,
        }),
        ...(input.digestFrequency !== undefined && {
          digestFrequency: input.digestFrequency,
        }),
        ...(input.quietHoursStart !== undefined && {
          quietHoursStart: input.quietHoursStart,
        }),
        ...(input.quietHoursEnd !== undefined && {
          quietHoursEnd: input.quietHoursEnd,
        }),
        ...(input.quietHoursTimezone !== undefined && {
          quietHoursTimezone: input.quietHoursTimezone,
        }),
        ...(input.maxNotificationsPerDay !== undefined && {
          maxNotificationsPerDay: input.maxNotificationsPerDay,
        }),
        ...(input.emailNotifications !== undefined && {
          emailNotifications: input.emailNotifications,
        }),
        ...(input.pushNotifications !== undefined && {
          pushNotifications: input.pushNotifications,
        }),
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(userPreferences)
    .values({
      userId,
      followedTopics: input.followedTopics ?? [],
      mutedTopics: input.mutedTopics ?? [],
      followedGeoAreas: input.followedGeoAreas ?? [],
      digestFrequency: input.digestFrequency ?? "daily",
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      quietHoursTimezone: input.quietHoursTimezone ?? "Asia/Tokyo",
      maxNotificationsPerDay: input.maxNotificationsPerDay ?? 10,
      emailNotifications: input.emailNotifications ?? true,
      pushNotifications: input.pushNotifications ?? true,
    })
    .returning();

  return created;
}
