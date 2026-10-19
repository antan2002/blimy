import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { LocalToolContext } from "@/features/ai/tools/types";

const MAX_SUBAGENT_TASK_LENGTH = 4000;
const MAX_SUBAGENT_STEPS_REQUEST = 20;

/**
 * Lets the main agent hand a self-contained research or reading task to a child
 * agent and get its report back. The child runs its own loop; the parent only
 * ever sees the summary.
 */
export function createSubagentTools({ runTool, runSubagent }: LocalToolContext): ToolSet {
  if (!runSubagent) return {};

  return {
    spawn_subagent: tool({
      description:
        "Hand a self-contained task to a child agent and get its report back. Use this to investigate several independent questions in parallel, or to keep a long search out of this conversation. The child cannot ask you questions, so the task must be complete on its own: say what to find and what to report.",
      inputSchema: z.object({
        task: z.string().min(1).max(MAX_SUBAGENT_TASK_LENGTH),
        maxSteps: z
          .number()
          .int()
          .min(1)
          .max(MAX_SUBAGENT_STEPS_REQUEST)
          .optional()
          .describe("Model requests the child may make. Keep this small for a narrow question."),
      }),
      execute: async (input, { toolCallId }) =>
        runTool(
          "spawn_subagent",
          "other",
          input,
          toolCallId,
          async () => {
            const result = await runSubagent(input);

            if (result.outcome === "failed") {
              return {
                error: result.error ?? "The subagent failed.",
                task: result.task,
                steps: result.steps,
              };
            }

            const note =
              result.outcome === "cancelled"
                ? "The subagent was cancelled."
                : result.outcome === "budget"
                  ? "The subagent hit its budget limit, so its report may be incomplete."
                  : result.truncated
                    ? "The subagent stopped at its step limit, so its report may be incomplete."
                    : undefined;

            return {
              task: result.task,
              report: result.summary === "" ? "The subagent returned no report." : result.summary,
              steps: result.steps,
              ...(note ? { note } : {}),
            };
          },
          {
            display: (result) => ({
              task: input.task,
              steps: (result as { steps?: number }).steps,
            }),
          },
        ),
    }),
  };
}
