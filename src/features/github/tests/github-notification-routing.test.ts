import { describe, expect, it } from "vite-plus/test";
import {
  buildGitHubRepositoryRef,
  getGitHubNotificationFallbackUrl,
  getGitHubNotificationTarget,
} from "../utils/github-notification-routing";

const workflowNotification = {
  id: "notification-1",
  title: "CI workflow run",
  subjectType: "CheckSuite",
  reason: "ci_activity",
  unread: true,
  updatedAt: "2026-08-14T12:00:00Z",
  lastReadAt: null,
  repositoryFullName: "blimydev/blimy",
  url: "https://github.com/blimydev/blimy",
  subjectUrl: "https://api.github.com/repos/blimydev/blimy/check-suites/501857806",
};

describe("GitHub notification repository routing", () => {
  it("rejects malformed repository names", () => {
    expect(buildGitHubRepositoryRef("blimydev/blimy/extra")).toBeNull();
    expect(buildGitHubRepositoryRef("../blimy")).toBeNull();
  });

  it("routes workflow and release fallbacks to their GitHub surfaces", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "blimydev/blimy",
        subjectType: "CheckSuite",
        url: "https://github.com/blimydev/blimy",
      }),
    ).toBe("https://github.com/blimydev/blimy/actions");
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "blimydev/blimy",
        subjectType: "Release",
        url: "https://github.com/blimydev/blimy",
      }),
    ).toBe("https://github.com/blimydev/blimy/releases");
  });

  it("routes unresolved workflow notifications to the native action viewer", () => {
    expect(getGitHubNotificationTarget(workflowNotification)).toEqual({
      type: "actionNotification",
      repoPath: "github://blimydev/blimy",
      notification: {
        id: "notification-1",
        repositoryFullName: "blimydev/blimy",
        checkSuiteId: 501857806,
        title: "CI workflow run",
        updatedAt: "2026-08-14T12:00:00Z",
      },
    });
  });

  it("preserves specific notification URLs", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "blimydev/blimy",
        subjectType: "Discussion",
        url: "https://github.com/blimydev/blimy/discussions/42",
      }),
    ).toBe("https://github.com/blimydev/blimy/discussions/42");
  });
});
