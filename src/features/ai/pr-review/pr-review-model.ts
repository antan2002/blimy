import { generateText } from "ai";

import { getIntelligenceSdkModel } from "@/features/ai/intelligence/services/intelligence-sdk-model";
import { useSettingsStore } from "@/features/settings/stores/settings.store";

import {
  PR_REVIEW_SYSTEM_PROMPT,
  type PullRequestReviewResult,
  parsePullRequestReview,
} from "./pr-review-report";

const MAX_PR_REVIEW_OUTPUT_TOKENS = 8_192;

export interface PrReviewModelRequest {
  prompt: string;
  /** The diff's changed files, used to drop findings that point at unknown paths. */
  changedFiles: string[];
  signal?: AbortSignal;
}

export interface PrReviewModelResult {
  result: PullRequestReviewResult;
  /** Provider and model that produced the review, for the page's footer. */
  modelLabel: string;
  /** The raw reply, kept so the page can fall back to plain text if parsing fails. */
  raw: string;
}

/**
 * One headless model turn for a pull request review. Like the bug finder, this
 * never touches `ai-chat.store`, so a review never becomes a chat message and
 * never disturbs the open conversation.
 */
export async function callPrReviewModel(
  request: PrReviewModelRequest,
): Promise<PrReviewModelResult> {
  const settings = useSettingsStore.getState().settings;
  const providerId = settings.aiProviderId;
  const modelId = settings.aiModelId;
  const model = await getIntelligenceSdkModel(providerId, modelId, "pr-review");
  const response = await generateText({
    model,
    system: PR_REVIEW_SYSTEM_PROMPT,
    prompt: request.prompt,
    maxOutputTokens: MAX_PR_REVIEW_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: request.signal,
  });

  return {
    result: parsePullRequestReview(response.text, request.changedFiles),
    modelLabel: `${providerId}/${modelId}`,
    raw: response.text,
  };
}
