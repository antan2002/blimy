import { describe, expect, it } from "vite-plus/test";
import { getAccountIdentity } from "@/features/window/lib/account-identity";

describe("account identity", () => {
  it("uses the connected GitHub identity when the auth profile is unavailable", () => {
    expect(getAccountIdentity(null, "blimydev")).toEqual({
      name: "blimydev",
      detail: "@blimydev",
      githubLogin: "blimydev",
      avatarUrl: "https://github.com/blimydev.png?size=64",
    });
  });

  it("prefers the account profile image over the GitHub fallback", () => {
    expect(
      getAccountIdentity(
        {
          id: 1,
          email: "you@example.com",
          name: "Blimy User",
          avatar_url: "https://example.com/profile.png",
          github_username: "blimydev",
          provider: null,
          subscription_status: "free",
          created_at: "2026-09-03T00:00:00.000Z",
        },
        "blimydev",
      ),
    ).toMatchObject({
      name: "Blimy User",
      avatarUrl: "https://example.com/profile.png",
    });
  });
});
