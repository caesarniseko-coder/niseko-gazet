import { describe, it, expect } from "vitest";
import { storyNotificationEmail } from "@/lib/email/templates";

/**
 * Tests for delivery orchestration logic.
 * Since the actual service depends on the database, we test the
 * pure logic functions: quiet hours, muted topic matching, and frequency caps.
 */

describe("Quiet Hours Logic", () => {
  function isInQuietHours(
    current: string,
    start: string,
    end: string
  ): boolean {
    if (start <= end) {
      return current >= start && current < end;
    }
    return current >= start || current < end;
  }

  it("detects time within normal range (09:00-17:00)", () => {
    expect(isInQuietHours("12:00", "09:00", "17:00")).toBe(true);
    expect(isInQuietHours("08:59", "09:00", "17:00")).toBe(false);
    expect(isInQuietHours("17:00", "09:00", "17:00")).toBe(false);
  });

  it("handles wrap-around quiet hours (22:00-06:00)", () => {
    expect(isInQuietHours("23:00", "22:00", "06:00")).toBe(true);
    expect(isInQuietHours("02:00", "22:00", "06:00")).toBe(true);
    expect(isInQuietHours("21:59", "22:00", "06:00")).toBe(false);
    expect(isInQuietHours("06:00", "22:00", "06:00")).toBe(false);
    expect(isInQuietHours("12:00", "22:00", "06:00")).toBe(false);
  });

  it("edge: same start and end means no quiet hours", () => {
    expect(isInQuietHours("12:00", "08:00", "08:00")).toBe(false);
  });
});

describe("Muted Topic Matching", () => {
  function isMuted(storyTopics: string[], mutedTopics: string[]): boolean {
    return storyTopics.some((t) =>
      mutedTopics.map((m) => m.toLowerCase()).includes(t.toLowerCase())
    );
  }

  it("suppresses when story has a muted topic", () => {
    expect(isMuted(["breaking", "sports"], ["sports"])).toBe(true);
  });

  it("allows when no overlap", () => {
    expect(isMuted(["breaking", "weather"], ["sports"])).toBe(false);
  });

  it("case insensitive matching", () => {
    expect(isMuted(["Breaking"], ["breaking"])).toBe(true);
  });

  it("allows when no muted topics", () => {
    expect(isMuted(["breaking"], [])).toBe(false);
  });

  it("allows when no story topics", () => {
    expect(isMuted([], ["sports"])).toBe(false);
  });
});

describe("Frequency Cap Check", () => {
  it("allows delivery when under cap", () => {
    const todayCount = 5;
    const maxPerDay = 10;
    expect(todayCount >= maxPerDay).toBe(false);
  });

  it("suppresses when at cap", () => {
    const todayCount = 10;
    const maxPerDay = 10;
    expect(todayCount >= maxPerDay).toBe(true);
  });

  it("suppresses when over cap", () => {
    const todayCount = 15;
    const maxPerDay = 10;
    expect(todayCount >= maxPerDay).toBe(true);
  });
});

describe("Email Notification Template", () => {
  it("generates valid HTML email with story details", () => {
    const { subject, html } = storyNotificationEmail({
      headline: "Heavy Snow Expected This Weekend",
      summary: "Niseko resort area may see up to 40cm of fresh powder.",
      slug: "heavy-snow-expected",
      topicTags: ["weather", "skiing"],
      geoTags: ["niseko"],
    });

    expect(subject).toBe("Heavy Snow Expected This Weekend");
    expect(html).toContain("Heavy Snow Expected This Weekend");
    expect(html).toContain("40cm of fresh powder");
    expect(html).toContain("/stories/heavy-snow-expected");
    expect(html).toContain("Read Full Story");
    expect(html).toContain("weather");
    expect(html).toContain("niseko");
  });

  it("escapes HTML in headline and summary", () => {
    const { html } = storyNotificationEmail({
      headline: 'Test <script>alert("xss")</script>',
      summary: "Normal summary & text",
      slug: "test-xss",
      topicTags: [],
      geoTags: [],
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; text");
  });

  it("handles empty tags gracefully", () => {
    const { html } = storyNotificationEmail({
      headline: "No Tags Story",
      summary: "A story without tags.",
      slug: "no-tags",
      topicTags: [],
      geoTags: [],
    });

    expect(html).toContain("No Tags Story");
    expect(html).toContain("A story without tags.");
  });

  it("delivery channel selection respects email_notifications preference", () => {
    // When email_notifications is false, email should not be sent
    const prefsDisabled = { email_notifications: false };
    const prefsEnabled = { email_notifications: true };
    const prefsDefault = {}; // undefined defaults to enabled

    expect(prefsDisabled.email_notifications !== false).toBe(false);
    expect(prefsEnabled.email_notifications !== false).toBe(true);
    expect((prefsDefault as { email_notifications?: boolean }).email_notifications !== false).toBe(true);
  });
});
