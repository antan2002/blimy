import { describe, expect, it } from "vite-plus/test";
import { getGitAuthorAvatarUrl } from "../utils/git-author-avatar";

const commit = {
  hash: "abc123",
  message: "Test commit",
  author: "Blimy Author",
  email: "you@example.com",
  date: "2026-07-15",
};

describe("getGitAuthorAvatarUrl", () => {
  it("uses the signed-in account avatar for a matching commit email", () => {
    expect(
      getGitAuthorAvatarUrl(commit, {
        email: "you@example.com",
        avatar_url: "https://example.com/Blimy User.png",
        github_username: "Blimy User",
      }),
    ).toBe("https://example.com/Blimy User.png");
  });

  it("falls back to the account GitHub avatar when no uploaded avatar exists", () => {
    expect(
      getGitAuthorAvatarUrl(commit, {
        email: "you@example.com",
        avatar_url: null,
        github_username: "blimy dev",
      }),
    ).toBe("https://github.com/Blimy User%20dev.png?size=64");
  });

  it("resolves GitHub noreply commit authors", () => {
    expect(
      getGitAuthorAvatarUrl({ ...commit, email: "12345+octocat@users.noreply.github.com" }, null),
    ).toBe("https://github.com/octocat.png?size=64");
  });

  it("leaves unknown authors to the initials fallback", () => {
    expect(getGitAuthorAvatarUrl(commit, null)).toBeNull();
  });

  it("accepts blame author identities without commit-list metadata", () => {
    expect(getGitAuthorAvatarUrl({ email: "12345+octocat@users.noreply.github.com" }, null)).toBe(
      "https://github.com/octocat.png?size=64",
    );
  });
});
