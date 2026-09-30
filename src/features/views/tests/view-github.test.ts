import { describe, expect, it, vi } from "vitest";
import {
  buildProjectGitHubApiUrl,
  parseGitHubRepository,
  resolveProjectGitHubRepository,
} from "@/features/views/lib/view-github";

describe("custom view GitHub integration", () => {
  it.each([
    ["https://github.com/antan2002/blimy.git", { owner: "Blimydev", repo: "Blimy" }],
    ["git@github.com:antan2002/blimy.git", { owner: "Blimydev", repo: "Blimy" }],
    ["github://antan2002/blimy", { owner: "Blimydev", repo: "Blimy" }],
  ])("parses GitHub repository references", (value, expected) => {
    expect(parseGitHubRepository(value)).toEqual(expected);
  });

  it("ignores remotes without a usable URL", () => {
    expect(parseGitHubRepository(undefined)).toBeNull();
    expect(parseGitHubRepository("")).toBeNull();
  });

  it("prefers the origin GitHub remote", async () => {
    const loadRemotes = vi.fn().mockResolvedValue([
      { name: "backup", url: "https://github.com/example/backup.git" },
      { name: "origin", url: "git@github.com:antan2002/blimy.git" },
    ]);

    await expect(resolveProjectGitHubRepository("/projects/Blimy", loadRemotes)).resolves.toEqual({
      owner: "Blimydev",
      repo: "Blimy",
    });
  });

  it("builds project-scoped API URLs and rejects unsafe paths", () => {
    const repository = { owner: "Blimydev", repo: "Blimy" };

    expect(buildProjectGitHubApiUrl(repository, "/releases?per_page=100")).toBe(
      "https://api.github.com/repos/antan2002/blimy/releases?per_page=100",
    );
    expect(() => buildProjectGitHubApiUrl(repository, "https://example.com/data")).toThrow(
      "invalid endpoint path",
    );
    expect(() => buildProjectGitHubApiUrl(repository, "/../other-repo")).toThrow(
      "invalid endpoint path",
    );
  });
});
