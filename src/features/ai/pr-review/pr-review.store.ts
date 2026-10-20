import { create } from "zustand";

import { createSelectors } from "@/utils/zustand-selectors";

import { runPullRequestReview } from "./pr-review-service";
import type { PullRequestReviewResult } from "./pr-review-report";

export function prReviewKey(repoPath: string, prNumber: number): string {
  return `${repoPath}::${prNumber}`;
}

export interface PrReviewEntry {
  status: "idle" | "running" | "ready" | "error";
  result: PullRequestReviewResult | null;
  raw: string;
  modelLabel: string;
  reviewedAt: number | null;
  error: string | null;
}

export const EMPTY_PR_REVIEW: PrReviewEntry = {
  status: "idle",
  result: null,
  raw: "",
  modelLabel: "",
  reviewedAt: null,
  error: null,
};

interface PrReviewState {
  entries: Record<string, PrReviewEntry>;
  actions: {
    run: (input: { repoPath: string; prNumber: number }) => Promise<void>;
    clear: (key: string) => void;
  };
}

const store = create<PrReviewState>((set, get) => ({
  entries: {},
  actions: {
    run: async ({ repoPath, prNumber }) => {
      const key = prReviewKey(repoPath, prNumber);

      if (get().entries[key]?.status === "running") return;

      const running: PrReviewEntry = { ...EMPTY_PR_REVIEW, status: "running" };
      set((state) => ({ entries: { ...state.entries, [key]: running } }));

      try {
        const outcome = await runPullRequestReview({ repoPath, prNumber });
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: {
              status: "ready",
              result: outcome.result,
              raw: outcome.raw,
              modelLabel: outcome.modelLabel,
              reviewedAt: outcome.reviewedAt,
              error: null,
            },
          },
        }));
      } catch (error) {
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: {
              ...EMPTY_PR_REVIEW,
              status: "error",
              error: error instanceof Error ? error.message : "Unable to review this pull request.",
            },
          },
        }));
      }
    },
    clear: (key) =>
      set((state) => {
        const next = { ...state.entries };
        delete next[key];
        return { entries: next };
      }),
  },
}));

export const usePrReviewStore = createSelectors(store);

export const selectPrReviewEntry =
  (key: string) =>
  (state: PrReviewState): PrReviewEntry =>
    state.entries[key] ?? EMPTY_PR_REVIEW;
