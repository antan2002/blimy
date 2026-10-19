import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { formatContinuousAgentRunTime } from "@/features/ai/continuous-agents/continuous-agent-schedule";
import {
  SCHEDULE_PROMPT_MAX_LENGTH,
  useScheduleJobsStore,
} from "@/features/ai/scheduling/schedule-job.store";
import type { LocalToolContext } from "@/features/ai/tools/types";

const CRON_HINT =
  "A five-field crontab in local time (minute, hour, day of month, month, day of week) or a preset such as @daily.";

function toResult(job: { id: string; cron: string; nextRunAt: number; prompt: string }) {
  const now = Date.now();
  return {
    id: job.id,
    cron: job.cron,
    prompt: job.prompt,
    nextRunAt: new Date(job.nextRunAt).toISOString(),
    nextRunIn: formatContinuousAgentRunTime(job.nextRunAt, now),
  };
}

/** Timers the agent can set for itself: recurring work that runs on a cron schedule. */
export function createScheduleTools({ root, readOnly, runTool }: LocalToolContext): ToolSet {
  // Scheduling changes persisted state, so a read-only run never sees these.
  if (readOnly) return {};

  const jobsForWorkspace = () =>
    useScheduleJobsStore
      .getState()
      .jobs.filter((job) => job.workspacePath === root)
      .sort((left, right) => left.nextRunAt - right.nextRunAt);

  return {
    schedule_agent_run: tool({
      description: `Schedule a prompt to run again later. ${CRON_HINT} Use this only when the user asks for something recurring or at a specific time, and never to defer work you can do now.`,
      inputSchema: z.object({
        cron: z.string().min(1).max(120),
        prompt: z.string().min(1).max(SCHEDULE_PROMPT_MAX_LENGTH),
      }),
      execute: async (input, { toolCallId }) =>
        runTool("schedule_agent_run", "other", input, toolCallId, async () => {
          try {
            const id = useScheduleJobsStore
              .getState()
              .actions.createJob({ ...input, workspacePath: root });
            const job = useScheduleJobsStore.getState().jobs.find((entry) => entry.id === id);
            return job ? toResult(job) : { id, cron: input.cron, prompt: input.prompt };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Unable to schedule the task.",
            };
          }
        }),
    }),
    list_scheduled_runs: tool({
      description:
        "List the scheduled runs in this workspace with their cron expression and next run time. Call this before scheduling so you do not add a duplicate timer.",
      inputSchema: z.object({}),
      execute: async (input, { toolCallId }) =>
        runTool("list_scheduled_runs", "other", input, toolCallId, async () => {
          const jobs = jobsForWorkspace();
          if (jobs.length === 0) return { scheduledRuns: "No scheduled runs." };
          return {
            scheduledRuns: jobs.map((job) => ({
              ...toResult(job),
              enabled: job.enabled,
              lastError: job.lastError,
            })),
          };
        }),
    }),
    cancel_scheduled_run: tool({
      description: "Delete a scheduled run by the id returned from schedule_agent_run.",
      inputSchema: z.object({ id: z.string().min(1).max(200) }),
      execute: async (input, { toolCallId }) =>
        runTool("cancel_scheduled_run", "other", input, toolCallId, async () => {
          const job = jobsForWorkspace().find((entry) => entry.id === input.id);
          if (!job) return { error: `No scheduled run with id "${input.id}".` };
          useScheduleJobsStore.getState().actions.deleteJob(job.id);
          return { canceled: true, id: job.id };
        }),
    }),
  };
}
