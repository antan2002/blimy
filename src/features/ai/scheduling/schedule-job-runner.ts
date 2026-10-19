import type { ScheduleJob } from "./schedule-job.store";

export interface ScheduleJobRunDependencies {
  getWorkspacePath: () => string | null;
  isAgentBusy: () => boolean;
  getDueJob: (workspacePath: string, now: number) => ScheduleJob | null;
  claimJob: (workspacePath: string, now: number, expectedJobId: string) => ScheduleJob | null;
  launchJob: (job: ScheduleJob) => void;
  pauseJob: (jobId: string, reason: string) => void;
  now?: () => number;
}

export type ScheduleJobRunResult =
  | { status: "idle" | "busy" }
  | { status: "started"; job: ScheduleJob }
  | { status: "paused"; job: ScheduleJob; reason: string };

function launchErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "blimy could not start the scheduled task.";
}

/**
 * Starts the job that is due first in the current workspace. The workspace and busy state are
 * re-read after the async gap a caller may introduce, and the job is claimed only once, so a
 * second tick cannot start the same run twice.
 */
export function runNextDueScheduleJob(
  dependencies: ScheduleJobRunDependencies,
): ScheduleJobRunResult {
  const workspacePath = dependencies.getWorkspacePath();
  if (!workspacePath) return { status: "idle" };
  if (dependencies.isAgentBusy()) return { status: "busy" };

  const now = dependencies.now?.() ?? Date.now();
  const dueJob = dependencies.getDueJob(workspacePath, now);
  if (!dueJob) return { status: "idle" };

  if (dependencies.getWorkspacePath() !== workspacePath) return { status: "idle" };
  if (dependencies.isAgentBusy()) return { status: "busy" };

  const claimedJob = dependencies.claimJob(workspacePath, now, dueJob.id);
  if (!claimedJob) return { status: "idle" };

  try {
    dependencies.launchJob(claimedJob);
    return { status: "started", job: claimedJob };
  } catch (error) {
    const reason = launchErrorMessage(error);
    dependencies.pauseJob(claimedJob.id, reason);
    return { status: "paused", job: claimedJob, reason };
  }
}

/** The prompt a fired timer hands to the agent. */
export function buildScheduleJobPrompt(prompt: string) {
  return [
    "A timer you set earlier has fired in this workspace.",
    "Carry out the task below now, verify the result, and leave a concise handoff in this session.",
    "If the task is already satisfied, report the evidence instead of inventing work.",
    "",
    prompt,
  ].join("\n");
}
