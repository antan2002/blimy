import { describe, expect, it } from "vite-plus/test";
import {
  buildPRBufferPath,
  isGitHubEntityLinkForRepository,
  isPRFilesViewPath,
  parseGitHubCheckSuiteId,
  parseGitHubEntityLink,
} from "../utils/github-link-utils";

describe("parseGitHubEntityLink", () => {
  it("parses pull request links with extra path segments and fragments", () => {
    expect(
      parseGitHubEntityLink("https://github.com/antan2002/blimy/pull/568/files#diff-123"),
    ).toMatchObject({
      kind: "pullRequest",
      owner: "Blimydev",
      repo: "Blimy",
      number: 568,
    });
  });

  it("parses issue links with trailing slashes", () => {
    expect(parseGitHubEntityLink("https://github.com/antan2002/blimy/issues/570/")).toMatchObject({
      kind: "issue",
      owner: "Blimydev",
      repo: "Blimy",
      number: 570,
    });
  });

  it("parses action run links", () => {
    expect(
      parseGitHubEntityLink("https://github.com/antan2002/blimy/actions/runs/23614391340"),
    ).toMatchObject({
      kind: "actionRun",
      owner: "Blimydev",
      repo: "Blimy",
      runId: 23614391340,
    });
  });

  it("parses commit links", () => {
    expect(
      parseGitHubEntityLink(
        "https://github.com/antan2002/blimy/commit/a507c60d7efaf08ec9823e16cf937a731ed2756d",
      ),
    ).toMatchObject({
      kind: "commit",
      owner: "Blimydev",
      repo: "Blimy",
      sha: "a507c60d7efaf08ec9823e16cf937a731ed2756d",
    });
  });

  it("accepts www.github.com links", () => {
    expect(parseGitHubEntityLink("https://www.github.com/antan2002/blimy/pull/568")).toMatchObject({
      kind: "pullRequest",
      owner: "Blimydev",
      repo: "Blimy",
      number: 568,
    });
  });

  it("rejects non-GitHub hosts and malformed entity ids", () => {
    expect(parseGitHubEntityLink("https://example.com/antan2002/blimy/pull/568")).toBeNull();
    expect(parseGitHubEntityLink("https://github.com/antan2002/blimy/pull/not-a-number")).toBeNull();
  });

  it("matches entity links to their repository", () => {
    const entityLink = parseGitHubEntityLink("https://github.com/antan2002/blimy/issues/714");

    expect(entityLink).not.toBeNull();
    if (!entityLink) return;

    expect(isGitHubEntityLinkForRepository(entityLink, "https://github.com/antan2002/blimy")).toBe(
      true,
    );
    expect(isGitHubEntityLinkForRepository(entityLink, "https://github.com/Blimydev/www")).toBe(
      false,
    );
    expect(isGitHubEntityLinkForRepository(entityLink, "git@github.com:antan2002/blimy.git")).toBe(
      true,
    );
  });
});

describe("parseGitHubCheckSuiteId", () => {
  it("reads check-suite notification API URLs", () => {
    expect(
      parseGitHubCheckSuiteId("https://api.github.com/repos/antan2002/blimy/check-suites/501857806"),
    ).toBe(501857806);
  });

  it("rejects unrelated URLs", () => {
    expect(parseGitHubCheckSuiteId("https://github.com/antan2002/blimy/actions")).toBeNull();
  });
});

describe("pull request buffer paths", () => {
  it("builds and recognizes a changed-files overview path", () => {
    const path = buildPRBufferPath(714, null, "files");

    expect(path).toBe("pr://714?view=files");
    expect(isPRFilesViewPath(path)).toBe(true);
  });

  it("recognizes selected-file paths as the files view", () => {
    const path = buildPRBufferPath(714, "src/app.tsx");

    expect(isPRFilesViewPath(path)).toBe(true);
    expect(isPRFilesViewPath(buildPRBufferPath(714))).toBe(false);
  });
});
