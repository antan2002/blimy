import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  computeNextRunAt,
  normalizePersistedScheduleJobs,
  selectNextDueJob,
  useScheduleJobsStore,
} from "../scheduling/schedule-job.store";

/** Cron runs in the user's timezone, so these dates must be built locally, never from UTC ISO. */
const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

describe("schedule jobs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useScheduleJobsStore.setState({ jobs: [] });
  });

  it("reports no next run for an expression that never matches", () => {
    expect(computeNextRunAt("0 0 30 2 *", local(2026, 1, 1, 0, 0).getTime())).toBeNull();
    expect(computeNextRunAt("*/15 * * * *", local(2026, 1, 1, 10, 30).getTime())).toBe(
      local(2026, 1, 1, 10, 45).getTime(),
    );
  });

  it("rejects an unusable timer", () => {
    const actions = useScheduleJobsStore.getState().actions;
    expect(() => actions.createJob({ prompt: "x", cron: "nope", workspacePath: "/repo" })).toThrow(
      /not a valid cron/,
    );
    expect(() =>
      actions.createJob({ prompt: " ", cron: "* * * * *", workspacePath: "/repo" }),
    ).toThrow(/between 1 and 20,000/);
    expect(() => actions.createJob({ prompt: "x", cron: "* * * * *", workspacePath: " " })).toThrow(
      /needs a workspace/,
    );
    expect(() =>
      actions.createJob({ prompt: "x", cron: "0 0 30 2 *", workspacePath: "/repo" }),
    ).toThrow(/never runs/);
  });

  it("arms the first run at the next cron occurrence", () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const jobId = useScheduleJobsStore.getState().actions.createJob({
      prompt: "Summarize overnight failures.",
      cron: "*/15 * * * *",
      workspacePath: "/repo",
    });

    expect(useScheduleJobsStore.getState().jobs[0]).toMatchObject({
      id: jobId,
      prompt: "Summarize overnight failures.",
      cron: "*/15 * * * *",
      workspacePath: "/repo",
      enabled: true,
      nextRunAt: local(2026, 1, 1, 10, 45).getTime(),
      lastRunAt: null,
      runCount: 0,
      lastError: null,
    });
  });

  it("claims only in the owning workspace and advances the schedule", () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const actions = useScheduleJobsStore.getState().actions;
    const jobId = actions.createJob({
      prompt: "Check the queue.",
      cron: "*/15 * * * *",
      workspacePath: "/repo",
    });

    const dueAt = local(2026, 1, 1, 10, 45).getTime();
    expect(actions.claimDueJob("/other", dueAt)).toBeNull();
    expect(actions.claimDueJob("/repo", dueAt - 1)).toBeNull();
    expect(actions.claimDueJob("/repo", dueAt)).toMatchObject({
      id: jobId,
      lastRunAt: dueAt,
      nextRunAt: local(2026, 1, 1, 11, 0).getTime(),
      runCount: 1,
      lastError: null,
    });
    expect(actions.claimDueJob("/repo", dueAt)).toBeNull();
    expect(useScheduleJobsStore.getState().jobs[0]).toMatchObject({ runCount: 1, enabled: true });
  });

  it("re-arms from now when a paused job is resumed", () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const actions = useScheduleJobsStore.getState().actions;
    const jobId = actions.createJob({
      prompt: "Daily digest.",
      cron: "0 9 * * *",
      workspacePath: "/repo",
    });

    actions.setJobEnabled(jobId, false);
    expect(useScheduleJobsStore.getState().jobs[0].enabled).toBe(false);

    // Resumed the next day well past 09:00, so the stale run must not fire immediately.
    const resumedAt = local(2026, 1, 2, 12, 0);
    vi.spyOn(Date, "now").mockReturnValue(resumedAt.getTime());
    actions.setJobEnabled(jobId, true);
    expect(useScheduleJobsStore.getState().jobs[0]).toMatchObject({
      enabled: true,
      lastError: null,
      nextRunAt: local(2026, 1, 3, 9, 0).getTime(),
    });
  });

  it("parks a job that fails", () => {
    vi.spyOn(Date, "now").mockReturnValue(local(2026, 1, 1, 10, 30).getTime());
    const actions = useScheduleJobsStore.getState().actions;
    const jobId = actions.createJob({
      prompt: "Audit deps.",
      cron: "0 3 * * *",
      workspacePath: "/repo",
    });

    actions.pauseJobForError(jobId, "Provider unavailable.");
    expect(useScheduleJobsStore.getState().jobs[0]).toMatchObject({
      enabled: false,
      lastError: "Provider unavailable.",
    });
    expect(actions.claimDueJob("/repo", local(2026, 1, 2, 3, 0).getTime())).toBeNull();
  });

  it("drops malformed persisted jobs and keeps the earliest due one", () => {
    const base = {
      prompt: "Ping.",
      cron: "@daily",
      workspacePath: "/repo",
      enabled: true,
      createdAt: 0,
      nextRunAt: 0,
      lastRunAt: null,
      runCount: 0,
      lastError: null,
    };
    const jobs = normalizePersistedScheduleJobs([
      { ...base, id: "keep" },
      { ...base, id: "keep", prompt: "Duplicate id." },
      { ...base, id: "bad", prompt: "" },
      { ...base, id: "" },
      "not an object",
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: "keep", cron: "0 0 * * *" });

    const now = local(2026, 1, 1, 10, 0).getTime();
    const earliest = selectNextDueJob(
      [
        { ...jobs[0], id: "later", nextRunAt: now + 1_000 },
        { ...jobs[0], id: "sooner", nextRunAt: now - 1_000 },
        { ...jobs[0], id: "disabled", enabled: false, nextRunAt: now - 5_000 },
        { ...jobs[0], id: "elsewhere", workspacePath: "/other", nextRunAt: now - 5_000 },
      ],
      "/repo",
      now,
    );
    expect(earliest?.id).toBe("sooner");
  });
});
