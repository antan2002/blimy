import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import type { LocalToolContext } from "@/features/ai/tools/types";

/** The subset of `github_get_pr_details` the review prompt needs. */
interface PullRequestDetailsResult {
  number: number;
  title: string;
  body: string;
  state: string;
  author: { login: string };
  isDraft: boolean;
  url: string;
  headRef: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: string | null;
  reviewDecision: string | null;
  labels: { name: string }[];
  reviews: { login: string; state: string; body: string; submittedAt: string | null }[];
}

interface PullRequestFileResult {
  path: string;
  additions: number;
  deletions: number;
}

interface PullRequestCommentResult {
  author: { login: string };
  body: string;
  createdAt: string;
}

/** A diff big enough to cover most pull requests without flooding the model's context. */
const MAX_DIFF_CHARS = 60_000;
const MAX_BODY_CHARS = 8_000;
const MAX_COMMENT_CHARS = 2_000;
const MAX_COMMENTS = 50;
const MAX_REVIEWS = 50;

function clamp(value: string, max: number): { text: string; truncated: boolean } {
  if (value.length <= max) return { text: value, truncated: false };
  return { text: `${value.slice(0, max)}\n... [truncated]`, truncated: true };
}

/** Accepts `owner/name`, `github.com/owner/name`, or a full pull request URL. */
function toRepositoryRef(value: string): string | null {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/?#\s]+)/i);
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/i, "")}`;
  const plainMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (plainMatch) return `${plainMatch[1]}/${plainMatch[2].replace(/\.git$/i, "")}`;
  return null;
}

const repositoryField = z
  .string()
  .min(1)
  .optional()
  .describe(
    "The repository as owner/name (for example vercel/next.js) or a GitHub URL. Omit it to use the repository open in the workspace.",
  );

const numberField = z.number().int().positive().describe("The pull request number.");

/**
 * Lets the agent read any pull request, including ones that are not checked out, over the existing
 * GitHub integration, and publish a review back. Reading is safe in every mode; publishing is only
 * offered when the run may change state.
 */
export function createGitHubPullRequestTools({
  root,
  readOnly,
  runTool,
}: LocalToolContext): ToolSet {
  // A missing repository falls back to the open workspace, whose git remote resolves to its slug.
  const resolveRepoPath = (
    repository?: string,
  ): { repoPath: string; repository: string } | { error: string } => {
    if (!repository) {
      if (!root) return { error: "No repository was given and no workspace is open." };
      return { repoPath: root, repository: root };
    }
    const ref = toRepositoryRef(repository);
    if (!ref) return { error: `"${repository}" is not a valid owner/name repository.` };
    return { repoPath: `github://${ref}`, repository: ref };
  };

  const tools: ToolSet = {
    read_pull_request: tool({
      description:
        "Read a GitHub pull request by repository and number. Returns its description, file list, conversation, existing reviews, and the unified diff, so it can be reviewed without checking the branch out first.",
      inputSchema: z.object({ repository: repositoryField, number: numberField }),
      execute: async (input, { toolCallId }) =>
        runTool(
          "read_pull_request",
          "fetch",
          input,
          toolCallId,
          async () => {
            const resolved = resolveRepoPath(input.repository);
            if ("error" in resolved) return { error: resolved.error };
            const { repoPath, repository } = resolved;
            try {
              const [details, files, comments, diff] = await Promise.all([
                invoke<PullRequestDetailsResult>("github_get_pr_details", {
                  repoPath,
                  prNumber: input.number,
                }),
                invoke<PullRequestFileResult[]>("github_get_pr_files", {
                  repoPath,
                  prNumber: input.number,
                }),
                invoke<PullRequestCommentResult[]>("github_get_pr_comments", {
                  repoPath,
                  prNumber: input.number,
                }),
                invoke<string>("github_get_pr_diff", { repoPath, prNumber: input.number }),
              ]);

              const body = clamp(details.body ?? "", MAX_BODY_CHARS);
              const diffResult = clamp(diff ?? "", MAX_DIFF_CHARS);
              return {
                repository,
                number: details.number,
                title: details.title,
                body: body.text,
                author: details.author?.login ?? "unknown",
                state: details.state,
                isDraft: details.isDraft,
                url: details.url,
                headRef: details.headRef,
                baseRef: details.baseRef,
                additions: details.additions,
                deletions: details.deletions,
                changedFiles: details.changedFiles,
                mergeable: details.mergeable,
                reviewDecision: details.reviewDecision,
                labels: (details.labels ?? []).map((label) => label.name),
                reviews: (details.reviews ?? []).slice(0, MAX_REVIEWS).map((review) => ({
                  author: review.login,
                  state: review.state,
                  body: clamp(review.body ?? "", MAX_COMMENT_CHARS).text,
                  submittedAt: review.submittedAt,
                })),
                files: (files ?? []).slice(0, 300).map((file) => ({
                  path: file.path,
                  additions: file.additions,
                  deletions: file.deletions,
                })),
                comments: (comments ?? []).slice(0, MAX_COMMENTS).map((comment) => ({
                  author: comment.author?.login ?? "unknown",
                  body: clamp(comment.body ?? "", MAX_COMMENT_CHARS).text,
                  createdAt: comment.createdAt,
                })),
                diff: diffResult.text,
                diffTruncated: diffResult.truncated,
                bodyTruncated: body.truncated,
              };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : "Unable to read the pull request.",
              };
            }
          },
          {
            display: () => ({ repository: input.repository, number: input.number }),
          },
        ),
    }),
  };

  if (readOnly) return tools;

  tools.submit_pull_request_review = tool({
    description:
      "Publish a review on a GitHub pull request. Use COMMENT to leave findings without approving, or APPROVE and REQUEST_CHANGES when the user asked for that decision. Requires push access to the repository.",
    inputSchema: z.object({
      repository: repositoryField,
      number: numberField,
      event: z
        .enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"])
        .describe("The review decision to submit."),
      body: z.string().min(1).max(MAX_BODY_CHARS).describe("The review text, written in Markdown."),
    }),
    execute: async (input, { toolCallId }) =>
      runTool(
        "submit_pull_request_review",
        "other",
        input,
        toolCallId,
        async () => {
          const resolved = resolveRepoPath(input.repository);
          if ("error" in resolved) return { error: resolved.error };
          const { repoPath, repository } = resolved;
          try {
            await invoke("github_submit_pr_review", {
              repoPath,
              prNumber: input.number,
              event: input.event,
              body: input.body,
            });
            return {
              submitted: true,
              repository,
              number: input.number,
              event: input.event,
            };
          } catch (error) {
            return {
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to submit the pull request review.",
            };
          }
        },
        {
          display: () => ({
            repository: input.repository,
            number: input.number,
            event: input.event,
          }),
        },
      ),
  });

  return tools;
}
