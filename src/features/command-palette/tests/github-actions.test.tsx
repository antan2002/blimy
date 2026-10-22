import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubActions } from "../constants/github-actions";

const { showPromptDialog } = vi.hoisted(() => ({ showPromptDialog: vi.fn() }));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/ui/dialog", () => ({ showPromptDialog }));

function createParams(repoPath: string | null = "/repo") {
  return {
    repoPath,
    setIsSidebarVisible: vi.fn(),
    setActiveView: vi.fn(),
    settings: {
      showGitHubPullRequests: true,
      showGitHubIssues: true,
      showGitHubActions: true,
      showGitHubReleases: true,
      showGitHubDeployments: true,
    },
    updateSetting: vi.fn(),
    checkAuth: vi.fn(async () => undefined),
    showToast: vi.fn(),
    openGitHubFormBuffer: vi.fn(() => "github-form"),
    openReleaseDraft: vi.fn(),
    openPullRequest: vi.fn(() => true),
    onClose: vi.fn(),
  };
}

describe("createGitHubActions", () => {
  beforeEach(() => {
    showPromptDialog.mockReset();
  });
  it("exposes every native GitHub creation surface", () => {
    const actions = createGitHubActions(createParams());

    expect(actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        "GitHub: New Issue",
        "GitHub: New Pull Request",
        "GitHub: Run Workflow",
      ]),
    );
  });

  it.each([
    ["github-new-issue", "issue"],
    ["github-new-pull-request", "pull-request"],
    ["github-run-workflow", "action"],
  ] as const)("opens %s in a native form buffer", (actionId, formKind) => {
    const params = createParams();
    const actions = createGitHubActions(params);

    actions.find((action) => action.id === actionId)?.action();

    expect(params.openGitHubFormBuffer).toHaveBeenCalledWith({ repoPath: "/repo", formKind });
    expect(params.onClose).toHaveBeenCalledOnce();
  });

  it("opens a release draft and exposes both delivery sections", () => {
    const params = createParams();
    const actions = createGitHubActions(params);
    actions.find((action) => action.id === "github-new-release")?.action();
    expect(params.openReleaseDraft).toHaveBeenCalledWith("/repo");
    expect(actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["github-show-releases", "github-show-deployments"]),
    );
  });

  it("does not create a release draft without a repository", () => {
    const params = createParams(null);
    createGitHubActions(params)
      .find((action) => action.id === "github-new-release")
      ?.action();
    expect(params.openReleaseDraft).not.toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith({ message: "No repository open", type: "error" });
  });

  it("reports when a creation command has no repository", () => {
    const params = createParams(null);

    createGitHubActions(params)
      .find((action) => action.id === "github-new-issue")
      ?.action();

    expect(params.openGitHubFormBuffer).not.toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith({
      message: "No repository open",
      type: "error",
    });
  });

  it("opens a pull request from a typed URL or shorthand", async () => {
    const params = createParams();
    showPromptDialog.mockResolvedValue("https://github.com/flutter/flutter/pull/160000");

    const action = createGitHubActions(params).find(
      (candidate) => candidate.id === "github-open-pull-request",
    );

    await action?.action();

    expect(params.openPullRequest).toHaveBeenCalledWith(
      "https://github.com/flutter/flutter/pull/160000",
    );
    expect(params.onClose).toHaveBeenCalledOnce();
  });

  it("reports an unreadable reference and stays open", async () => {
    const params = createParams();
    showPromptDialog.mockResolvedValue("not a pull request");
    params.openPullRequest = vi.fn(() => false);

    const action = createGitHubActions(params).find(
      (candidate) => candidate.id === "github-open-pull-request",
    );

    await action?.action();

    expect(params.showToast).toHaveBeenCalledWith({
      message: "That is not a pull request. Use a URL or owner/repo#123.",
      type: "error",
    });
    expect(params.onClose).not.toHaveBeenCalled();
  });

  it("does nothing when the prompt is dismissed", async () => {
    const params = createParams();
    showPromptDialog.mockResolvedValue(null);

    const action = createGitHubActions(params).find(
      (candidate) => candidate.id === "github-open-pull-request",
    );

    await action?.action();

    expect(params.openPullRequest).not.toHaveBeenCalled();
    expect(params.onClose).not.toHaveBeenCalled();
  });
});
