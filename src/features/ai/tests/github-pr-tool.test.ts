import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createGitHubPullRequestTools } from "@/features/ai/tools/github-pr-tool";
import type { LocalToolContext } from "@/features/ai/tools/types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function context(overrides: Partial<LocalToolContext> = {}): LocalToolContext {
  return {
    root: "/w",
    readOnly: false,
    signal: new AbortController().signal,
    runTool: async (_name, _kind, _input, _id, execute) => execute(),
    ...overrides,
  };
}

interface RunnableTool {
  execute: (input: unknown, options: { toolCallId: string }) => Promise<unknown>;
}

function tool(contextValue: LocalToolContext, name: string): RunnableTool {
  return createGitHubPullRequestTools(contextValue)[name] as unknown as RunnableTool;
}

const details = {
  number: 42,
  title: "Add caching",
  body: "Adds a cache layer.",
  state: "OPEN",
  author: { login: "octocat" },
  isDraft: false,
  url: "https://github.com/vercel/next.js/pull/42",
  headRef: "feature/cache",
  baseRef: "main",
  additions: 12,
  deletions: 3,
  changedFiles: 1,
  mergeable: "MERGEABLE",
  reviewDecision: null,
  labels: [{ name: "enhancement" }],
  reviews: [{ login: "reviewer", state: "APPROVED", body: "Looks good", submittedAt: null }],
};

const files = [{ path: "src/cache.ts", additions: 12, deletions: 3 }];
const comments = [
  { author: { login: "octocat" }, body: "Please add tests", createdAt: "2026-01-01" },
];

describe("github pull request tools", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("offers reading in every mode and publishing only when the run may change state", () => {
    expect(Object.keys(createGitHubPullRequestTools(context({ readOnly: true }))).sort()).toEqual([
      "read_pull_request",
    ]);
    expect(Object.keys(createGitHubPullRequestTools(context())).sort()).toEqual([
      "read_pull_request",
      "submit_pull_request_review",
    ]);
  });

  it("reads any repository through the github:// ref and maps the review payload", async () => {
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "github_get_pr_details") return Promise.resolve(details);
      if (command === "github_get_pr_files") return Promise.resolve(files);
      if (command === "github_get_pr_comments") return Promise.resolve(comments);
      if (command === "github_get_pr_diff") return Promise.resolve("diff --git a/src/cache.ts");
      return Promise.resolve(undefined);
    });

    const result = (await tool(context(), "read_pull_request").execute(
      { repository: "https://github.com/vercel/next.js/pull/42", number: 42 },
      { toolCallId: "call-1" },
    )) as Record<string, unknown>;

    expect(mocks.invoke).toHaveBeenCalledWith("github_get_pr_details", {
      repoPath: "github://vercel/next.js",
      prNumber: 42,
    });
    expect(result).toMatchObject({
      repository: "vercel/next.js",
      number: 42,
      title: "Add caching",
      author: "octocat",
      files: [{ path: "src/cache.ts", additions: 12, deletions: 3 }],
      diff: "diff --git a/src/cache.ts",
      diffTruncated: false,
      labels: ["enhancement"],
    });
  });

  it("falls back to the open workspace repository when none is given", async () => {
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "github_get_pr_details") return Promise.resolve(details);
      if (command === "github_get_pr_files") return Promise.resolve(files);
      if (command === "github_get_pr_comments") return Promise.resolve(comments);
      if (command === "github_get_pr_diff") return Promise.resolve("");
      return Promise.resolve(undefined);
    });

    await tool(context({ root: "/work/repo" }), "read_pull_request").execute(
      { number: 7 },
      { toolCallId: "call-1" },
    );

    expect(mocks.invoke).toHaveBeenCalledWith("github_get_pr_details", {
      repoPath: "/work/repo",
      prNumber: 7,
    });
  });

  it("rejects a repository that is not owner/name", async () => {
    const result = await tool(context(), "read_pull_request").execute(
      { repository: "not a repo", number: 1 },
      { toolCallId: "call-1" },
    );
    expect(result).toEqual({ error: '"not a repo" is not a valid owner/name repository.' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("publishes a review through the submit command", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    const result = await tool(context(), "submit_pull_request_review").execute(
      { repository: "vercel/next.js", number: 42, event: "COMMENT", body: "One nit." },
      { toolCallId: "call-1" },
    );

    expect(mocks.invoke).toHaveBeenCalledWith("github_submit_pr_review", {
      repoPath: "github://vercel/next.js",
      prNumber: 42,
      event: "COMMENT",
      body: "One nit.",
    });
    expect(result).toEqual({
      submitted: true,
      repository: "vercel/next.js",
      number: 42,
      event: "COMMENT",
    });
  });
});
