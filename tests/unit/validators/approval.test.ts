import { describe, it, expect } from "vitest";
import {
  createApprovalSchema,
  publishSchema,
} from "@/lib/validators/approval";

const VALID_HASH = "a".repeat(64); // Valid 64-char SHA-256 hash

describe("createApprovalSchema", () => {
  it("accepts valid approval", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "approved",
      notes: "LGTM",
    });
    expect(result.success).toBe(true);
  });

  it("accepts approval with risk acknowledgements", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "approved",
      riskAcknowledgements: [
        {
          flagType: "minor_involved",
          acknowledged: true,
          justification: "Parent has given consent for reporting",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts rejection decision", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "rejected",
      notes: "Needs more sources",
    });
    expect(result.success).toBe(true);
  });

  it("accepts revision_requested decision", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "revision_requested",
      notes: "Please add second source",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid decision", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "maybe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects version hash that is not 64 chars", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: "tooshort",
      decision: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects risk acknowledgement without justification", () => {
    const result = createApprovalSchema.safeParse({
      versionHash: VALID_HASH,
      decision: "approved",
      riskAcknowledgements: [
        {
          flagType: "minor_involved",
          acknowledged: true,
          justification: "",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("publishSchema", () => {
  it("accepts valid version hash", () => {
    const result = publishSchema.safeParse({
      versionHash: VALID_HASH,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing version hash", () => {
    const result = publishSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects wrong length hash", () => {
    const result = publishSchema.safeParse({
      versionHash: "abc123",
    });
    expect(result.success).toBe(false);
  });
});
