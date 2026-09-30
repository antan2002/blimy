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
  repositoryFullName: "antan2002/blimy",
  url: "https://github.com/antan2002/blimy",
  subjectUrl: "https://api.github.com/repos/antan2002/blimy/check-suites/501857806",
};

describe("GitHub notification repository routing", () => {
  it("rejects malformed repository names", () => {
    expect(buildGitHubRepositoryRef("antan2002/blimy/extra")).toBeNull();
    expect(buildGitHubRepositoryRef("../Blimy")).toBeNull();
  });

  it("routes workflow and release fallbacks to their GitHub surfaces", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "antan2002/blimy",
        subjectType: "CheckSuite",
        url: "https://github.com/antan2002/blimy",
      }),
    ).toBe("https://github.com/antan2002/blimy/actions");
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "antan2002/blimy",
        subjectType: "Release",
        url: "https://github.com/antan2002/blimy",
      }),
    ).toBe("https://github.com/antan2002/blimy/releases");
  });

  it("routes unresolved workflow notifications to the native action viewer", () => {
    expect(getGitHubNotificationTarget(workflowNotification)).toEqual({
      type: "actionNotification",
      repoPath: "github://antan2002/blimy",
      notification: {
        id: "notification-1",
        repositoryFullName: "antan2002/blimy",
        checkSuiteId: 501857806,
        title: "CI workflow run",
        updatedAt: "2026-08-14T12:00:00Z",
      },
    });
  });

  it("preserves specific notification URLs", () => {
    expect(
      getGitHubNotificationFallbackUrl({
        repositoryFullName: "antan2002/blimy",
        subjectType: "Discussion",
        url: "https://github.com/antan2002/blimy/discussions/42",
      }),
    ).toBe("https://github.com/antan2002/blimy/discussions/42");
  });
});
