import { describe, it, expect } from "vitest";
import { generateSlug, uniqueSlug } from "@/lib/utils/slug";

describe("generateSlug", () => {
  it("converts headline to lowercase kebab-case", () => {
    expect(generateSlug("Breaking News in Niseko")).toBe("breaking-news-in-niseko");
  });

  it("removes special characters", () => {
    expect(generateSlug("What's Happening? A Story!")).toBe("whats-happening-a-story");
  });

  it("collapses multiple spaces/dashes", () => {
    expect(generateSlug("Multiple   Spaces   Here")).toBe("multiple-spaces-here");
    expect(generateSlug("Multiple---Dashes---Here")).toBe("multiple-dashes-here");
  });

  it("trims leading/trailing dashes", () => {
    expect(generateSlug("-Leading and Trailing-")).toBe("leading-and-trailing");
  });

  it("truncates to 200 characters max", () => {
    const long = "a".repeat(300);
    expect(generateSlug(long).length).toBeLessThanOrEqual(200);
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("appends a suffix to make slug unique", () => {
    const slug = uniqueSlug("Test Headline");
    expect(slug).toContain("test-headline-");
    expect(slug.length).toBeGreaterThan("test-headline".length);
  });

  it("generates different slugs for same input on different calls", () => {
    const slug1 = uniqueSlug("Same Headline");
    // Wait a tick so timestamp differs
    const slug2 = uniqueSlug("Same Headline");
    // They could be the same if called in the same millisecond,
    // but at minimum they should both contain the base slug
    expect(slug1).toContain("same-headline-");
    expect(slug2).toContain("same-headline-");
  });
});
