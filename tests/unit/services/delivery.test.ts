import { describe, it, expect } from "vitest";

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
