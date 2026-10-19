import type { SubagentOutcome } from "@/features/ai/tools/types";

export interface SubagentAgentRunParams {
  sessionId: string;
  prompt: string;
  maxSteps: number;
}

export interface SubagentAgentRunResult {
  outcome: "completed" | "cancelled" | "budget" | "failed";
  text: string;
  steps: number;
  costUsd?: number;
  /** True when the child stopped on a step or token limit instead of finishing. */
  truncated?: boolean;
  error?: string;
}

export interface SubagentManagerOptions {
  /** Runs one nested turn. The parent agent service injects its own loop here. */
  runAgent: (params: SubagentAgentRunParams) => Promise<SubagentAgentRunResult>;
  /** Session id for the nth child of this run. Must not collide with a real session. */
  buildSessionId: (index: number) => string;
  /** Step cap for a child; a tool call may ask for fewer, never more. */
  maxSteps: number;
  /** Children that may run at the same time. */
  maxConcurrent: number;
  /** Longest report handed back to the parent, so one child cannot flood the turn. */
  maxSummaryChars: number;
}

export interface SubagentManager {
  run: (input: { task: string; maxSteps?: number }) => Promise<SubagentOutcome>;
  activeCount: () => number;
}

const MIN_SUBAGENT_STEPS = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createSubagentManager(options: SubagentManagerOptions): SubagentManager {
  let nextIndex = 0;
  let active = 0;

  const fail = (task: string, error: string): SubagentOutcome => ({
    task,
    summary: "",
    steps: 0,
    outcome: "failed",
    truncated: false,
    error,
  });

  const run: SubagentManager["run"] = async ({ task, maxSteps }) => {
    const trimmedTask = task.trim();

    if (trimmedTask === "") {
      return fail(task, "A subagent needs a task description.");
    }

    if (active >= options.maxConcurrent) {
      return fail(
        trimmedTask,
        `Too many subagents are already running (${options.maxConcurrent} at a time).`,
      );
    }

    const steps =
      maxSteps === undefined
        ? options.maxSteps
        : clamp(Math.round(maxSteps), MIN_SUBAGENT_STEPS, options.maxSteps);

    nextIndex += 1;
    active += 1;

    try {
      const result = await options.runAgent({
        sessionId: options.buildSessionId(nextIndex),
        prompt: trimmedTask,
        maxSteps: steps,
      });
      const text = result.text.trim();
      const summary =
        text.length > options.maxSummaryChars
          ? `${text.slice(0, options.maxSummaryChars)}\n... (report truncated)`
          : text;

      return {
        task: trimmedTask,
        summary,
        steps: result.steps,
        outcome: result.outcome,
        // A child that ran out of steps or budget stopped early, so the parent
        // knows the report may be incomplete.
        truncated: Boolean(result.truncated) || result.outcome === "budget",
        ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
        ...(result.error ? { error: result.error } : {}),
      };
    } catch (error) {
      return fail(trimmedTask, error instanceof Error ? error.message : "The subagent failed.");
    } finally {
      active -= 1;
    }
  };

  return {
    run,
    activeCount: () => active,
  };
}
