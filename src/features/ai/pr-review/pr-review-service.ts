import { invoke } from "@tauri-apps/api/core";

import { callPrReviewModel } from "./pr-review-model";
import { buildPullRequestReviewPrompt, type PullRequestReviewResult } from "./pr-review-report";

interface PrDetailsResult {
  title: string;
  body: string;
}

interface PrFileResult {
  path: string;
}

export interface PrReviewOutcome {
  result: PullRequestReviewResult;
  modelLabel: string;
  raw: string;
  reviewedAt: number;
}

/**
 * Fetches a pull request over the existing GitHub commands and reviews it with
 * one headless model turn. It accepts any repository reference the commands
 * understand, including `github://owner/name`, so it is not tied to the
 * workspace.
 */
export async function runPullRequestReview(input: {
  repoPath: string;
  prNumber: number;
  signal?: AbortSignal;
}): Promise<PrReviewOutcome> {
  const { repoPath, prNumber, signal } = input;
  const [details, files, diff] = await Promise.all([
    invoke<PrDetailsResult>("github_get_pr_details", { repoPath, prNumber }),
    invoke<PrFileResult[]>("github_get_pr_files", { repoPath, prNumber }),
    invoke<string>("github_get_pr_diff", { repoPath, prNumber }),
  ]);

  signal?.throwIfAborted();

  const changedFiles = (files ?? []).map((file) => file.path);
  const prompt = buildPullRequestReviewPrompt({
    repository: repoPath,
    number: prNumber,
    title: details?.title ?? "",
    body: details?.body ?? "",
    files: changedFiles,
    diff: diff ?? "",
  });
  const response = await callPrReviewModel({ prompt, changedFiles, signal });

  return { ...response, reviewedAt: Date.now() };
}
