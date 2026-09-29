import { describe, expect, it } from "vite-plus/test";
import { calculateCost, resolveModelPrice } from "@/features/ai/cost/calculate-cost";
import { BudgetTracker, TurnBudget, formatBudgetStopMessage } from "@/features/ai/cost/budget-tracker";
import { DEFAULT_MODEL_PRICE, findModelPrice } from "@/features/ai/cost/model-prices";
import { normalizeAgentBudgetUsd } from "@/features/ai/lib/agent-budget";

describe("calculateCost", () => {
  it("prices input and output at their own rates", () => {
    // 1M input at $3 plus 1M output at $15.
    expect(calculateCost("claude-sonnet-4-5", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
    expect(calculateCost("claude-sonnet-4-5", 0, 1_000_000)).toBeCloseTo(15, 6);
  });

  it("charges nothing for a local model", () => {
    expect(calculateCost("llama3", 1_000_000, 1_000_000, "ollama")).toBe(0);
  });

  it("bills an unknown model at the default rather than treating it as free", () => {
    expect(calculateCost("some-unreleased-model", 1_000_000, 1_000_000)).toBeCloseTo(
      DEFAULT_MODEL_PRICE.input + DEFAULT_MODEL_PRICE.output,
      6,
    );
  });

  it("keeps a date-suffixed or namespaced id on its real price", () => {
    expect(calculateCost("claude-sonnet-4-5-20250929", 1_000_000, 0)).toBeCloseTo(3, 6);
    expect(calculateCost("anthropic/claude-sonnet-4-5", 1_000_000, 0)).toBeCloseTo(3, 6);
  });

  it("ignores negative and non-finite token counts", () => {
    expect(calculateCost("gpt-4o", -100, Number.NaN)).toBe(0);
  });
});

describe("findModelPrice", () => {
  it("prefers the longest matching prefix", () => {
    expect(findModelPrice("gpt-4o-mini")).toEqual({ input: 0.15, output: 0.6 });
    expect(findModelPrice("gpt-4o")).toEqual({ input: 2.5, output: 10 });
  });

  it("returns nothing for an empty id", () => {
    expect(findModelPrice("   ")).toBeUndefined();
  });
});

describe("resolveModelPrice", () => {
  it("reports local providers as free whatever the model is called", () => {
    expect(resolveModelPrice("gpt-4o", "ollama")).toEqual({ input: 0, output: 0 });
  });

  it("falls back to the default price for an unknown model", () => {
    expect(resolveModelPrice("mystery-model")).toEqual(DEFAULT_MODEL_PRICE);
  });
});

describe("BudgetTracker", () => {
  it("accumulates tokens and cost across steps", () => {
    const tracker = new BudgetTracker();
    tracker.addUsage("gpt-4o", 1_000_000, 0);
    tracker.addUsage("gpt-4o", 0, 1_000_000);
    expect(tracker.getSummary()).toMatchObject({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 2_000_000,
      costUsd: 12.5,
      steps: 2,
    });
  });

  it("only reports over budget once the cost passes the limit", () => {
    const tracker = new BudgetTracker();
    tracker.addUsage("claude-sonnet-4-5", 0, 1_000); // $0.015
    expect(tracker.isOverBudget(1)).toBe(false);
    expect(tracker.isOverBudget(0.01)).toBe(true);
  });

  it("never trips without a limit", () => {
    const tracker = new BudgetTracker();
    tracker.addUsage("claude-opus-4-5", 10_000_000, 10_000_000);
    expect(tracker.isOverBudget(null)).toBe(false);
    expect(tracker.isOverBudget(undefined)).toBe(false);
    expect(tracker.isOverBudget(0)).toBe(false);
    expect(tracker.isOverBudget(Number.NaN)).toBe(false);
  });

  it("reports a stop that names what was spent and what was allowed", () => {
    const tracker = new BudgetTracker();
    tracker.addUsage("claude-opus-4-5", 1_000_000, 0); // $5
    const stop = tracker.checkBudget(1);
    expect(stop).toEqual({ reason: "budget", costUsd: 5, limitUsd: 1 });
    expect(formatBudgetStopMessage(stop!)).toContain("$1.00");
    expect(formatBudgetStopMessage(stop!)).toContain("$5.00");
  });

  it("returns no stop while the task may continue", () => {
    const tracker = new BudgetTracker();
    tracker.addUsage("gpt-4o-mini", 1_000, 1_000);
    expect(tracker.checkBudget(1)).toBeUndefined();
  });

  it("keeps the running total monotonic as steps are added", () => {
    const tracker = new BudgetTracker();
    let previous = 0;
    for (let step = 0; step < 5; step++) {
      const running = tracker.addUsage("gpt-4o", 10_000, 5_000);
      expect(running).toBeGreaterThan(previous);
      previous = running;
    }
  });
});

describe("TurnBudget", () => {
  /** Replays the loop in `intelligence-agent.ts`: check, then run, then meter. */
  function runTurn(
    budget: TurnBudget,
    stepCosts: Array<[number, number]>,
    model = { id: "gpt-4o", providerId: "openai" },
  ) {
    const requestsMade: number[] = [];
    stepCosts.forEach(([input, output], index) => {
      if (budget.check()) return; // prepareStep refused: no request goes out
      requestsMade.push(index);
      budget.addUsage(model.id, input, output, model.providerId);
    });
    return { requestsMade, stopReason: budget.stopReason };
  }

  // gpt-4o is $2.50/1M input and $10/1M output, so a step of 400k input plus
  // 1k output costs $1.00 + $0.01 = $1.01.
  const STEP_COST = 1.01;

  it("stops the turn once a step takes it past the limit", () => {
    const budget = new TurnBudget(1.5, new BudgetTracker());
    const { requestsMade, stopReason } = runTurn(budget, [
      [400_000, 1_000],
      [400_000, 1_000],
      [400_000, 1_000],
      [400_000, 1_000],
    ]);
    // Two steps ran; the second passed $1.50, so the third request never went out.
    expect(requestsMade).toEqual([0, 1]);
    expect(stopReason?.costUsd).toBeCloseTo(STEP_COST * 2, 6);
    expect(stopReason?.limitUsd).toBe(1.5);
  });

  it("lets every step run when no limit is set", () => {
    const budget = new TurnBudget(null);
    const { requestsMade, stopReason } = runTurn(budget, [
      [400_000, 1_000],
      [400_000, 1_000],
      [400_000, 1_000],
    ]);
    expect(requestsMade).toEqual([0, 1, 2]);
    expect(stopReason).toBeUndefined();
    expect(budget.isStopCondition()).toBe(false);
  });

  it("allows the final request that lands exactly on the limit", () => {
    const budget = new TurnBudget(1);
    expect(budget.check()).toBeUndefined();
    budget.addUsage("gpt-4o", 400_000, 0, "openai"); // exactly $1.00
    expect(budget.isOverBudget(1)).toBe(false);
    expect(budget.check()).toBeUndefined();
  });

  it("reports the stop condition only after the budget is checked", () => {
    const budget = new TurnBudget(0.5);
    expect(budget.isStopCondition()).toBe(false);
    budget.addUsage("gpt-4o", 400_000, 0, "openai");
    budget.check();
    expect(budget.isStopCondition()).toBe(true);
  });

  it("never stops a local model run, whatever the limit", () => {
    const budget = new TurnBudget(0.0001);
    const { requestsMade, stopReason } = runTurn(
      budget,
      [
        [10_000_000, 10_000_000],
        [10_000_000, 10_000_000],
      ],
      { id: "llama3", providerId: "ollama" },
    );
    expect(requestsMade).toEqual([0, 1]);
    expect(stopReason).toBeUndefined();
    expect(budget.getSummary().costUsd).toBe(0);
  });

  it("keeps the overspend to at most one step", () => {
    const stepCost: [number, number] = [400_000, 1_000];
    const budget = new TurnBudget(0.5);
    const { stopReason } = runTurn(budget, [stepCost, stepCost]);
    // It stopped on the request after the first step, having spent about one step
    // past the limit rather than stopping mid-step.
    expect(stopReason?.costUsd).toBeCloseTo(STEP_COST, 6);
    expect(stopReason!.costUsd - 0.5).toBeLessThanOrEqual(STEP_COST);
  });
});

describe("normalizeAgentBudgetUsd", () => {
  it("has no limit by default", () => {
    expect(normalizeAgentBudgetUsd(null)).toBeNull();
    expect(normalizeAgentBudgetUsd(undefined)).toBeNull();
  });

  it("rounds to cents and rejects values that are not a positive amount", () => {
    expect(normalizeAgentBudgetUsd(1.239)).toBe(1.24);
    expect(normalizeAgentBudgetUsd(0)).toBeNull();
    expect(normalizeAgentBudgetUsd(-5)).toBeNull();
    expect(normalizeAgentBudgetUsd(Number.NaN)).toBeNull();
    expect(normalizeAgentBudgetUsd("2")).toBeNull();
  });
});
