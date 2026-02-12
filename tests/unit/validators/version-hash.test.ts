import { describe, it, expect } from "vitest";
import { generateVersionHash } from "@/lib/utils/version-hash";
import type { ContentBlock, SourceEntry, RiskFlag } from "@/lib/db/schema";

describe("generateVersionHash", () => {
  const sampleContentBlocks: ContentBlock[] = [
    { type: "text", content: "This is the article body." },
    { type: "image", content: "https://example.com/photo.jpg" },
  ];

  const sampleSourceLog: SourceEntry[] = [
    { source: "Niseko Town Hall", verified: true, notes: "Official" },
  ];

  const sampleRiskFlags: RiskFlag[] = [
    {
      type: "identifiable_private_individual",
      description: "John Doe is named",
      severity: "medium",
    },
  ];

  it("produces a 64-character hex string (SHA-256)", () => {
    const hash = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: same input produces same hash", () => {
    const hash1 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    const hash2 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    expect(hash1).toBe(hash2);
  });

  it("changes when content blocks change", () => {
    const hash1 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    const modifiedBlocks: ContentBlock[] = [
      { type: "text", content: "Modified article body." },
    ];
    const hash2 = generateVersionHash(
      modifiedBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    expect(hash1).not.toBe(hash2);
  });

  it("changes when source log changes", () => {
    const hash1 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    const modifiedSources: SourceEntry[] = [
      { source: "Different Source", verified: false, notes: "Unverified" },
    ];
    const hash2 = generateVersionHash(
      sampleContentBlocks,
      modifiedSources,
      sampleRiskFlags
    );
    expect(hash1).not.toBe(hash2);
  });

  it("changes when risk flags change", () => {
    const hash1 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      sampleRiskFlags
    );
    const hash2 = generateVersionHash(
      sampleContentBlocks,
      sampleSourceLog,
      []
    );
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty arrays", () => {
    const hash = generateVersionHash(
      [{ type: "text", content: "minimal" }],
      [],
      []
    );
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
