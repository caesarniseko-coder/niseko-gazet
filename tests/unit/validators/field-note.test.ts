import { describe, it, expect } from "vitest";
import {
  createFieldNoteSchema,
  updateFieldNoteSchema,
} from "@/lib/validators/field-note";

describe("createFieldNoteSchema", () => {
  it("accepts valid minimal field note", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "Fire broke out at ski lodge",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full field note", () => {
    const result = createFieldNoteSchema.safeParse({
      who: "Niseko Fire Department",
      what: "Structure fire at Grand Hirafu ski lodge",
      whenOccurred: "2026-02-10T14:30:00Z",
      whereLocation: "Grand Hirafu, Niseko",
      why: "Electrical fault suspected",
      how: "Fire spread through ventilation system",
      quotes: [
        {
          speaker: "Chief Tanaka",
          text: "We responded within 5 minutes",
          context: "Post-incident briefing",
        },
      ],
      contacts: [
        {
          name: "Chief Tanaka",
          role: "Fire Chief",
          phone: "+81-136-44-1234",
        },
      ],
      evidenceRefs: [
        {
          type: "photo",
          url: "https://storage.example.com/fire-001.jpg",
          description: "Aerial view of fire",
        },
      ],
      confidenceScore: 85,
      safetyLegalFlags: ["identifiable_private_individual"],
      geoLat: "42.8621",
      geoLng: "140.6874",
      rawText: "Got a call about fire at the lodge...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing 'what' field", () => {
    const result = createFieldNoteSchema.safeParse({
      who: "Someone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty 'what' field", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence score > 100", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "Something happened",
      confidenceScore: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence score < 0", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "Something happened",
      confidenceScore: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid evidence ref URL", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "Something",
      evidenceRefs: [
        { type: "photo", url: "not-a-url", description: "bad" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid risk flag type", () => {
    const result = createFieldNoteSchema.safeParse({
      what: "Something",
      safetyLegalFlags: ["invalid_flag_type"],
    });
    expect(result.success).toBe(false);
  });

  it("defaults arrays to empty", () => {
    const result = createFieldNoteSchema.parse({
      what: "Minimal note",
    });
    expect(result.quotes).toEqual([]);
    expect(result.contacts).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.safetyLegalFlags).toEqual([]);
  });
});

describe("updateFieldNoteSchema", () => {
  it("accepts partial updates", () => {
    const result = updateFieldNoteSchema.safeParse({
      who: "Updated source",
      status: "processing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateFieldNoteSchema.safeParse({
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateFieldNoteSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
