import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useScheduleJobsStore } from "../scheduling/schedule-job.store";
import { createScheduleTools } from "../tools/schedule-tool";
import type { LocalToolContext, LocalToolRun } from "../tools/types";

const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

function buildTools(readOnly = false) {
  const runTool: LocalToolRun = (_name, _kind, _input, _id, execute) => execute();
  const context: LocalToolContext = {
    root: "/repo",
    readOnly,
    signal: new AbortController().signal,
    runTool,
  };
  return createScheduleTools(context);
}

type ToolResult = Record<string, unknown>;

function call(tools: ReturnType<typeof createScheduleTools>, name: string, input: unknown) {
  const execute = tools[name]?.execute as unknown as
    | ((input: unknown, options: Record<string, unknown>) => Promise<ToolResult>)
    | undefined;
  if (!execute) throw new Error(`Tool "${name}" is missing.`);
  return execute(input, { toolCallId: "test-call", messages: [] });
}

describe("schedule tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useScheduleJobsStore.setState({ jobs: [] });
  });

  it("offers nothing to a read-only run", () => {
    expect(Object.keys(buildTools(true))).toEqual([]);
    expect(Object.keys(buildTools(false)).sort()).toEqual([
      "cancel_scheduled_run",
      "list_scheduled_runs",
      "schedule_agent_run",
    ]);
  });

  it("creates a workspace-scoped timer and reports the next run", async () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());

    const result = await call(buildTools(), "schedule_agent_run", {
      cron: "*/15 * * * *",
      prompt: "Check the overnight failures.",
    });

    expect(result).toMatchObject({
      cron: "*/15 * * * *",
      prompt: "Check the overnight failures.",
      nextRunAt: local(2026, 1, 1, 10, 45).toISOString(),
      nextRunIn: "in 15m",
    });
    expect(useScheduleJobsStore.getState().jobs[0]).toMatchObject({
      workspacePath: "/repo",
      runCount: 0,
    });
  });

  it("reports a bad expression instead of storing it", async () => {
    const result = await call(buildTools(), "schedule_agent_run", {
      cron: "every morning",
      prompt: "Standup notes.",
    });

    expect(result.error).toMatch(/not a valid cron/);
    expect(useScheduleJobsStore.getState().jobs).toHaveLength(0);
  });

  it("lists only this workspace's timers", async () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const tools = buildTools();

    expect(await call(tools, "list_scheduled_runs", {})).toEqual({
      scheduledRuns: "No scheduled runs.",
    });

    await call(tools, "schedule_agent_run", { cron: "@daily", prompt: "Digest." });
    useScheduleJobsStore.getState().actions.createJob({
      cron: "@daily",
      prompt: "Other repo work.",
      workspacePath: "/other",
    });

    const listed = await call(tools, "list_scheduled_runs", {});
    expect(listed.scheduledRuns).toHaveLength(1);
    expect((listed.scheduledRuns as ToolResult[])[0]).toMatchObject({
      cron: "0 0 * * *",
      prompt: "Digest.",
      enabled: true,
    });
  });

  it("cancels by id and reports an unknown id", async () => {
    const now = local(2026, 1, 1, 10, 30);
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const tools = buildTools();

    const created = await call(tools, "schedule_agent_run", {
      cron: "@hourly",
      prompt: "Reindex.",
    });
    expect(await call(tools, "cancel_scheduled_run", { id: created.id })).toEqual({
      canceled: true,
      id: created.id,
    });
    expect(useScheduleJobsStore.getState().jobs).toHaveLength(0);
    expect(await call(tools, "cancel_scheduled_run", { id: "missing" })).toMatchObject({
      error: expect.stringContaining("missing"),
    });
  });
});
