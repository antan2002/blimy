import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getSupabaseAccessToken } from "../supabase-access-token";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/features/auth/lib/supabase", () => ({
  supabase: { auth: { getSession: auth.getSession } },
}));

beforeEach(() => {
  auth.getSession.mockReset();
});

describe("getSupabaseAccessToken", () => {
  it("returns the access token of the live session", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "eyJhbGciOiJIUzI1NiJ9" } },
      error: null,
    });
    await expect(getSupabaseAccessToken()).resolves.toBe("eyJhbGciOiJIUzI1NiJ9");
  });

  it("returns null when there is no session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getSupabaseAccessToken()).resolves.toBeNull();
  });

  it("returns null when the session carries no access token", async () => {
    auth.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(getSupabaseAccessToken()).resolves.toBeNull();
  });

  it("returns null when reading the session fails", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("auth unavailable"),
    });
    await expect(getSupabaseAccessToken()).resolves.toBeNull();
  });
});