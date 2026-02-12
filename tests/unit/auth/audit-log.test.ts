import { describe, it, expect } from "vitest";
import { extractRequestMeta } from "@/lib/utils/audit-log";

describe("extractRequestMeta", () => {
  it("extracts x-forwarded-for and user-agent", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.50, 70.41.3.18",
        "user-agent": "Mozilla/5.0 Test",
      },
    });

    const meta = extractRequestMeta(req);
    expect(meta.ipAddress).toBe("203.0.113.50");
    expect(meta.userAgent).toBe("Mozilla/5.0 Test");
  });

  it("falls back to x-real-ip when x-forwarded-for missing", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-real-ip": "10.0.0.1",
        "user-agent": "TestBot/1.0",
      },
    });

    const meta = extractRequestMeta(req);
    expect(meta.ipAddress).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = new Request("http://localhost", {
      headers: {
        "user-agent": "TestBot/1.0",
      },
    });

    const meta = extractRequestMeta(req);
    expect(meta.ipAddress).toBe("unknown");
  });

  it("returns 'unknown' for user-agent when missing", () => {
    const req = new Request("http://localhost");
    const meta = extractRequestMeta(req);
    expect(meta.userAgent).toBe("unknown");
  });

  it("trims whitespace from x-forwarded-for first entry", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "  192.168.1.1 , 10.0.0.1",
      },
    });

    const meta = extractRequestMeta(req);
    expect(meta.ipAddress).toBe("192.168.1.1");
  });
});
