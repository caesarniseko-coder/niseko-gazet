import { supabase } from "@/lib/supabase/server";
import { toCamelCase } from "@/lib/supabase/helpers";
import type { UpdatePreferencesInput, CreateSubscriptionInput } from "@/lib/validators/subscriber";

// ── Subscriptions ──────────────────────────────────────

export async function getSubscription(userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get subscription: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function createSubscription(
  userId: string,
  input: CreateSubscriptionInput
) {
  const existing = await getSubscription(userId);
  if (existing) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        plan: input.plan,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update subscription: ${error.message}`);
    return toCamelCase(data);
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: input.plan,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);
  return toCamelCase(data);
}

export async function cancelSubscription(userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return null;
  return data ? toCamelCase(data) : null;
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId) as Record<string, unknown> | null;
  if (!sub || !sub.isActive) return false;
  if (sub.expiresAt && new Date(sub.expiresAt as string) < new Date()) return false;
  return true;
}

export async function hasEntitlement(
  userId: string,
  requiredPlan: string
): Promise<boolean> {
  const sub = await getSubscription(userId) as Record<string, unknown> | null;
  if (!sub || !sub.isActive) return false;

  const planHierarchy: Record<string, number> = {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3,
  };

  return (planHierarchy[sub.plan as string] ?? 0) >= (planHierarchy[requiredPlan] ?? 0);
}

// ── User Preferences ───────────────────────────────────

export async function getPreferences(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get preferences: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput
) {
  const existing = await getPreferences(userId);

  if (existing) {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.followedTopics !== undefined) updateData.followed_topics = input.followedTopics;
    if (input.mutedTopics !== undefined) updateData.muted_topics = input.mutedTopics;
    if (input.followedGeoAreas !== undefined) updateData.followed_geo_areas = input.followedGeoAreas;
    if (input.digestFrequency !== undefined) updateData.digest_frequency = input.digestFrequency;
    if (input.quietHoursStart !== undefined) updateData.quiet_hours_start = input.quietHoursStart;
    if (input.quietHoursEnd !== undefined) updateData.quiet_hours_end = input.quietHoursEnd;
    if (input.quietHoursTimezone !== undefined) updateData.quiet_hours_timezone = input.quietHoursTimezone;
    if (input.maxNotificationsPerDay !== undefined) updateData.max_notifications_per_day = input.maxNotificationsPerDay;
    if (input.emailNotifications !== undefined) updateData.email_notifications = input.emailNotifications;
    if (input.pushNotifications !== undefined) updateData.push_notifications = input.pushNotifications;

    const { data, error } = await supabase
      .from("user_preferences")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update preferences: ${error.message}`);
    return toCamelCase(data);
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .insert({
      user_id: userId,
      followed_topics: input.followedTopics ?? [],
      muted_topics: input.mutedTopics ?? [],
      followed_geo_areas: input.followedGeoAreas ?? [],
      digest_frequency: input.digestFrequency ?? "daily",
      quiet_hours_start: input.quietHoursStart ?? null,
      quiet_hours_end: input.quietHoursEnd ?? null,
      quiet_hours_timezone: input.quietHoursTimezone ?? "Asia/Tokyo",
      max_notifications_per_day: input.maxNotificationsPerDay ?? 10,
      email_notifications: input.emailNotifications ?? true,
      push_notifications: input.pushNotifications ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create preferences: ${error.message}`);
  return toCamelCase(data);
}
