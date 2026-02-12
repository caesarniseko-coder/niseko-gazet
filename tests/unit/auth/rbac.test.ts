import { describe, it, expect, vi } from "vitest";

// Mock next-auth and next/server to avoid ESM resolution issues in vitest
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: { json: vi.fn() },
}));
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));

import { hasRole, hasAnyRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/types/enums";

describe("hasRole", () => {
  it("admin has any role", () => {
    const roles: UserRole[] = [
      "anonymous",
      "subscriber",
      "journalist",
      "moderator",
      "editor",
      "admin",
    ];
    for (const role of roles) {
      expect(hasRole("admin", role)).toBe(true);
    }
  });

  it("subscriber does not have journalist role", () => {
    expect(hasRole("subscriber", "journalist")).toBe(false);
  });

  it("editor has moderator role", () => {
    expect(hasRole("editor", "moderator")).toBe(true);
  });

  it("anonymous has only anonymous role", () => {
    expect(hasRole("anonymous", "anonymous")).toBe(true);
    expect(hasRole("anonymous", "subscriber")).toBe(false);
  });

  it("same role satisfies requirement", () => {
    expect(hasRole("journalist", "journalist")).toBe(true);
    expect(hasRole("moderator", "moderator")).toBe(true);
  });

  it("lower role does not satisfy higher requirement", () => {
    expect(hasRole("journalist", "editor")).toBe(false);
    expect(hasRole("moderator", "admin")).toBe(false);
  });
});

describe("hasAnyRole", () => {
  it("matches when user has one of the allowed roles", () => {
    expect(hasAnyRole("journalist", ["journalist", "editor"])).toBe(true);
  });

  it("matches when user role exceeds an allowed role", () => {
    expect(hasAnyRole("admin", ["editor"])).toBe(true);
  });

  it("fails when user role is below all allowed roles", () => {
    expect(hasAnyRole("subscriber", ["journalist", "editor"])).toBe(false);
  });

  it("empty allowed roles array always fails", () => {
    expect(hasAnyRole("admin", [])).toBe(false);
  });

  it("works with single-element array", () => {
    expect(hasAnyRole("editor", ["moderator"])).toBe(true);
    expect(hasAnyRole("subscriber", ["moderator"])).toBe(false);
  });
});
