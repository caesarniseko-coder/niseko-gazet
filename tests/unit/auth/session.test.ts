/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the auth module before importing session helpers
vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { auth } from "@/lib/auth/config";

const mockAuth = vi.mocked(auth);

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session", async () => {
    mockAuth.mockResolvedValue(null as any);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns null when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null } as any);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns session user with correct shape", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "editor",
        name: "Test Editor",
        email: "editor@test.com",
      },
    } as any);

    const user = await getCurrentUser();
    expect(user).toEqual({
      id: "user-1",
      role: "editor",
      name: "Test Editor",
      email: "editor@test.com",
    });
  });

  it("defaults name and email to empty string if null", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "user-2",
        role: "journalist",
        name: null,
        email: null,
      },
    } as any);

    const user = await getCurrentUser();
    expect(user).toEqual({
      id: "user-2",
      role: "journalist",
      name: "",
      email: "",
    });
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "admin",
        name: "Admin",
        email: "admin@test.com",
      },
    } as any);

    const user = await requireUser();
    expect(user.id).toBe("user-1");
    expect(user.role).toBe("admin");
  });

  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    await expect(requireUser()).rejects.toThrow("Authentication required");
  });
});
