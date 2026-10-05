import { calculateCost } from "./calculate-cost";

export interface CostSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  steps: number;
}

export interface BudgetStop {
  reason: "budget";
  costUsd: number;
  limitUsd: number;
}

/** Running token and dollar totals for one agent task. */
export class BudgetTracker {
  private inputTokens = 0;
  private outputTokens = 0;
  private costUsd = 0;
  private steps = 0;

  /** Records what one model request cost, and returns the new running total. */
  addUsage(modelId: string, inputTokens: number, outputTokens: number, providerId?: string): number {
    this.inputTokens += Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
    this.outputTokens += Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
    this.costUsd += calculateCost(modelId, inputTokens, outputTokens, providerId);
    this.steps += 1;
    return this.costUsd;
  }

  getCostUsd(): number {
    return this.costUsd;
  }

  /** True once the task has passed the limit. A missing or non-positive limit never trips. */
  isOverBudget(limitUsd: number | null | undefined): boolean {
    if (typeof limitUsd !== "number" || !Number.isFinite(limitUsd) || limitUsd <= 0) return false;
    return this.costUsd > limitUsd;
  }

  getSummary(): CostSummary {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
      costUsd: this.costUsd,
      steps: this.steps,
    };
  }

  /** What to tell the user when the task is stopped, or undefined while it may continue. */
  checkBudget(limitUsd: number | null | undefined): BudgetStop | undefined {
    if (!this.isOverBudget(limitUsd)) return undefined;
    return { reason: "budget", costUsd: this.costUsd, limitUsd: limitUsd as number };
  }
}

/**
 * Drives one agent turn's budget the way `intelligence-agent.ts` does: usage is
 * metered as each step finishes, and the next step is refused once the running
 * total is past the limit.
 */
export class TurnBudget {
  private readonly tracker: BudgetTracker;
  private readonly limitUsd: number | null;
  private stop: BudgetStop | undefined;

  constructor(limitUsd: number | null | undefined, tracker = new BudgetTracker()) {
    this.limitUsd = typeof limitUsd === "number" && Number.isFinite(limitUsd) ? limitUsd : null;
    this.tracker = tracker;
  }

  /** Records what a finished step cost. */
  addUsage(modelId: string, inputTokens: number, outputTokens: number, providerId?: string): void {
    this.tracker.addUsage(modelId, inputTokens, outputTokens, providerId);
  }

  /** Called before each request; sets the stop once the turn is over its limit. */
  check(): BudgetStop | undefined {
    this.stop = this.tracker.checkBudget(this.limitUsd);
    return this.stop;
  }

  isStopCondition = (): boolean => Boolean(this.stop);

  isOverBudget(limitUsd: number | null | undefined): boolean {
    return this.tracker.isOverBudget(limitUsd);
  }

  get stopReason(): BudgetStop | undefined {
    return this.stop;
  }

  getSummary(): CostSummary {
    return this.tracker.getSummary();
  }
}

/** The message a task ends with when its budget stops it. */
export function formatBudgetStopMessage(stop: BudgetStop): string {
  return `Stopped: this task reached its budget of $${stop.limitUsd.toFixed(2)} ` +
    `after spending $${stop.costUsd.toFixed(2)}. ` +
    "Raise the limit in AI settings to let it keep going.";
}
