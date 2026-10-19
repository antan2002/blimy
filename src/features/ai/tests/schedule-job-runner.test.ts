import { describe, expect, it, vi } from "vite-plus/test";
import type { ScheduleJob } from "../scheduling/schedule-job.store";
import {
  buildScheduleJobPrompt,
  runNextDueScheduleJob,
  type ScheduleJobRunDependencies,
} from "../scheduling/schedule-job-runner";

const job: ScheduleJob = {
  id: "job-1",
  prompt: "Check overnight failures.",
  cron: "0 9 * * *",
  workspacePath: "/repo",
  enabled: true,
  createdAt: 0,
  nextRunAt: 0,
  lastRunAt: null,
  runCount: 0,
  lastError: null,
};

function dependencies(overrides: Partial<ScheduleJobRunDependencies> = {}) {
  return {
    getWorkspacePath: () => "/repo",
    isAgentBusy: () => false,
    getDueJob: () => job,
    claimJob: () => job,
    launchJob: vi.fn(),
    pauseJob: vi.fn(),
    now: () => 1_000,
    ...overrides,
  } satisfies ScheduleJobRunDependencies;
}

describe("schedule job runner", () => {
  it("stays idle without a workspace and while the agent is busy", () => {
    expect(runNextDueScheduleJob(dependencies({ getWorkspacePath: () => null }))).toEqual({
      status: "idle",
    });
    expect(runNextDueScheduleJob(dependencies({ isAgentBusy: () => true }))).toEqual({
      status: "busy",
    });
  });

  it("stays idle when nothing is due", () => {
    const launchJob = vi.fn();
    const result = runNextDueScheduleJob(dependencies({ getDueJob: () => null, launchJob }));
    expect(result).toEqual({ status: "idle" });
    expect(launchJob).not.toHaveBeenCalled();
  });

  it("drops the run when the workspace changed or the agent became busy", () => {
    const claimJob = vi.fn();
    const workspaces = ["/repo", "/other"];
    expect(
      runNextDueScheduleJob(
        dependencies({ getWorkspacePath: () => workspaces.shift() ?? "/other", claimJob }),
      ),
    ).toEqual({ status: "idle" });

    const busyStates = [false, true];
    expect(
      runNextDueScheduleJob(
        dependencies({ isAgentBusy: () => busyStates.shift() ?? true, claimJob }),
      ),
    ).toEqual({ status: "busy" });
    expect(claimJob).not.toHaveBeenCalled();
  });

  it("stays idle when another tick already claimed the job", () => {
    expect(runNextDueScheduleJob(dependencies({ claimJob: () => null }))).toEqual({
      status: "idle",
    });
  });

  it("claims from the same workspace before launching", () => {
    const claimJob = vi.fn(() => job);
    const launchJob = vi.fn();
    const result = runNextDueScheduleJob(dependencies({ claimJob, launchJob }));

    expect(result).toEqual({ status: "started", job });
    expect(claimJob).toHaveBeenCalledWith("/repo", 1_000, "job-1");
    expect(launchJob).toHaveBeenCalledWith(job);
  });

  it("parks the job when the launch fails", () => {
    const pauseJob = vi.fn();
    const result = runNextDueScheduleJob(
      dependencies({
        launchJob: () => {
          throw new Error("No agent selected.");
        },
        pauseJob,
      }),
    );

    expect(result).toMatchObject({ status: "paused", reason: "No agent selected." });
    expect(pauseJob).toHaveBeenCalledWith("job-1", "No agent selected.");
  });

  it("describes a fired timer without losing the task", () => {
    const prompt = buildScheduleJobPrompt("Reindex the docs.");
    expect(prompt).toContain("timer you set earlier has fired");
    expect(prompt).toContain("Reindex the docs.");
  });
});
