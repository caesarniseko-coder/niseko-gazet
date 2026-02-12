import { describe, it, expect } from "vitest";
import {
  createStorySchema,
  updateStorySchema,
  createStoryVersionSchema,
} from "@/lib/validators/story";

describe("createStorySchema", () => {
  it("accepts valid minimal story", () => {
    const result = createStorySchema.safeParse({
      headline: "Niseko Ski Resort Opens New Terrain",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full story", () => {
    const result = createStorySchema.safeParse({
      headline: "Major Snowfall Expected This Weekend",
      summary: "Niseko is set to receive 50cm of fresh powder.",
      topicTags: ["weather", "skiing"],
      geoTags: ["niseko", "hirafu"],
      isGated: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty headline", () => {
    const result = createStorySchema.safeParse({
      headline: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing headline", () => {
    const result = createStorySchema.safeParse({
      summary: "No headline provided",
    });
    expect(result.success).toBe(false);
  });

  it("rejects headline over 512 chars", () => {
    const result = createStorySchema.safeParse({
      headline: "x".repeat(513),
    });
    expect(result.success).toBe(false);
  });

  it("defaults tags to empty arrays", () => {
    const result = createStorySchema.parse({
      headline: "Test",
    });
    expect(result.topicTags).toEqual([]);
    expect(result.geoTags).toEqual([]);
    expect(result.isGated).toBe(false);
  });
});

describe("updateStorySchema", () => {
  it("accepts partial updates", () => {
    const result = updateStorySchema.safeParse({
      status: "in_review",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateStorySchema.safeParse({
      status: "nonexistent",
    });
    expect(result.success).toBe(false);
  });
});

describe("createStoryVersionSchema", () => {
  it("accepts valid version with content blocks", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [
        { type: "text", content: "The article body goes here." },
        {
          type: "image",
          content: "https://example.com/photo.jpg",
          metadata: { caption: "A snowy mountain" },
        },
      ],
      sourceLog: [
        { source: "Niseko Town Hall", verified: true, notes: "Official statement" },
      ],
      riskFlags: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content blocks array", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid content block type", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [
        { type: "invalid_type", content: "test" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects content block with empty content", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [
        { type: "text", content: "" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("validates risk flag severity", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [{ type: "text", content: "test" }],
      riskFlags: [
        {
          type: "minor_involved",
          description: "Story involves a minor",
          severity: "high",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid risk flag severity", () => {
    const result = createStoryVersionSchema.safeParse({
      contentBlocks: [{ type: "text", content: "test" }],
      riskFlags: [
        {
          type: "minor_involved",
          description: "Story involves a minor",
          severity: "critical",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
