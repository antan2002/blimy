import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { runPullRequestReview } = vi.hoisted(() => ({ runPullRequestReview: vi.fn() }));

vi.mock("@/features/ai/pr-review/pr-review-service", () => ({ runPullRequestReview }));

import {
  prReviewKey,
  selectPrReviewEntry,
  usePrReviewStore,
} from "@/features/ai/pr-review/pr-review.store";

const repoPath = "github://octo/repo";
const key = prReviewKey(repoPath, 7);

const outcome = {
  result: { summary: "Reads well.", verdict: "comment" as const, findings: [] },
  modelLabel: "test/model",
  raw: "{}",
  reviewedAt: 1,
};

describe("pr review store", () => {
  beforeEach(() => {
    runPullRequestReview.mockReset();
    usePrReviewStore.setState({ entries: {} });
  });

  it("moves to ready on success", async () => {
    runPullRequestReview.mockResolvedValue(outcome);

    await usePrReviewStore.getState().actions.run({ repoPath, prNumber: 7 });

    const entry = usePrReviewStore.getState().entries[key];

    expect(entry.status).toBe("ready");
    expect(entry.result).toEqual(outcome.result);
    expect(entry.modelLabel).toBe("test/model");
  });

  it("moves to error with the failure message", async () => {
    runPullRequestReview.mockRejectedValue(new Error("nope"));

    await usePrReviewStore.getState().actions.run({ repoPath, prNumber: 7 });

    const entry = usePrReviewStore.getState().entries[key];

    expect(entry.status).toBe("error");
    expect(entry.error).toBe("nope");
  });

  it("ignores a second run while one is in flight", async () => {
    let release: (value: typeof outcome) => void = () => {};
    runPullRequestReview.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const first = usePrReviewStore.getState().actions.run({ repoPath, prNumber: 7 });

    expect(usePrReviewStore.getState().entries[key].status).toBe("running");

    await usePrReviewStore.getState().actions.run({ repoPath, prNumber: 7 });

    expect(runPullRequestReview).toHaveBeenCalledTimes(1);

    release(outcome);
    await first;

    expect(usePrReviewStore.getState().entries[key].status).toBe("ready");
  });

  it("clears an entry, and reports idle through the selector", async () => {
    expect(selectPrReviewEntry(key)(usePrReviewStore.getState()).status).toBe("idle");

    runPullRequestReview.mockResolvedValue(outcome);
    await usePrReviewStore.getState().actions.run({ repoPath, prNumber: 7 });

    usePrReviewStore.getState().actions.clear(key);

    expect(usePrReviewStore.getState().entries[key]).toBeUndefined();
    expect(selectPrReviewEntry(key)(usePrReviewStore.getState()).status).toBe("idle");
  });
});
