import { describe, it, expect } from "vitest";
import {
  updatePreferencesSchema,
  createSubscriptionSchema,
} from "@/lib/validators/subscriber";

describe("updatePreferencesSchema", () => {
  it("accepts valid preferences update", () => {
    const result = updatePreferencesSchema.safeParse({
      followedTopics: ["skiing", "food", "events"],
      mutedTopics: ["politics"],
      digestFrequency: "weekly",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxNotificationsPerDay: 5,
      emailNotifications: true,
      pushNotifications: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty update (no changes)", () => {
    const result = updatePreferencesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update", () => {
    const result = updatePreferencesSchema.safeParse({
      mutedTopics: ["crime"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid quiet hours format", () => {
    const result = updatePreferencesSchema.safeParse({
      quietHoursStart: "10pm",
    });
    expect(result.success).toBe(false);
  });

  it("rejects notifications per day over 100", () => {
    const result = updatePreferencesSchema.safeParse({
      maxNotificationsPerDay: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative notifications per day", () => {
    const result = updatePreferencesSchema.safeParse({
      maxNotificationsPerDay: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid digest frequency", () => {
    const result = updatePreferencesSchema.safeParse({
      digestFrequency: "hourly",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSubscriptionSchema", () => {
  it("accepts valid subscription", () => {
    const result = createSubscriptionSchema.safeParse({
      plan: "premium",
    });
    expect(result.success).toBe(true);
  });

  it("accepts subscription with stripe IDs", () => {
    const result = createSubscriptionSchema.safeParse({
      plan: "basic",
      stripeCustomerId: "cus_abc123",
      stripeSubscriptionId: "sub_xyz789",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid plan", () => {
    const result = createSubscriptionSchema.safeParse({
      plan: "ultimate",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing plan", () => {
    const result = createSubscriptionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
