import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "@/utils/zustand-selectors";
import { createSafeJSONStorage } from "@/utils/zustand-storage";
import { nextCronRun, parseCron } from "@/features/ai/tools/cron";

/** A timer an agent set with a cron expression, scoped to the workspace it runs in. */
export interface ScheduleJob {
  id: string;
  /** What the agent is asked to do when the timer fires. */
  prompt: string;
  /** The normalized cron expression. */
  cron: string;
  workspacePath: string;
  enabled: boolean;
  createdAt: number;
  nextRunAt: number;
  lastRunAt: number | null;
  runCount: number;
  lastError: string | null;
}

interface CreateScheduleJobInput {
  prompt: string;
  cron: string;
  workspacePath: string;
}

interface ScheduleJobsState {
  jobs: ScheduleJob[];
  actions: {
    createJob: (input: CreateScheduleJobInput) => string;
    deleteJob: (jobId: string) => void;
    setJobEnabled: (jobId: string, enabled: boolean) => void;
    claimDueJob: (
      workspacePath: string,
      now?: number,
      expectedJobId?: string,
    ) => ScheduleJob | null;
    pauseJobForError: (jobId: string, reason: string) => void;
  };
}

type PersistedScheduleJobsState = Pick<ScheduleJobsState, "jobs">;

export const SCHEDULE_PROMPT_MAX_LENGTH = 20_000;

function createJobId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/** The next run for a cron, or null when the expression never matches. */
export function computeNextRunAt(cron: string, now = Date.now()): number | null {
  return nextCronRun(parseCron(cron), new Date(now))?.getTime() ?? null;
}

function isValidCron(cron: string) {
  try {
    parseCron(cron);
    return true;
  } catch {
    return false;
  }
}

function normalizePersistedJob(value: unknown): ScheduleJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Partial<ScheduleJob>;
  const id = typeof job.id === "string" ? job.id.trim() : "";
  const prompt = typeof job.prompt === "string" ? job.prompt.trim() : "";
  const cron = typeof job.cron === "string" ? job.cron.trim() : "";
  const workspacePath = typeof job.workspacePath === "string" ? job.workspacePath.trim() : "";
  if (
    !id ||
    !prompt ||
    prompt.length > SCHEDULE_PROMPT_MAX_LENGTH ||
    !cron ||
    !isValidCron(cron) ||
    !workspacePath ||
    typeof job.enabled !== "boolean" ||
    typeof job.createdAt !== "number" ||
    !Number.isFinite(job.createdAt) ||
    typeof job.nextRunAt !== "number" ||
    !Number.isFinite(job.nextRunAt) ||
    (job.lastRunAt !== null && typeof job.lastRunAt !== "number") ||
    typeof job.runCount !== "number" ||
    !Number.isSafeInteger(job.runCount) ||
    job.runCount < 0
  ) {
    return null;
  }
  return {
    id,
    prompt,
    cron: parseCron(cron).expression,
    workspacePath,
    enabled: job.enabled,
    createdAt: job.createdAt,
    nextRunAt: job.nextRunAt,
    lastRunAt: job.lastRunAt,
    runCount: job.runCount,
    lastError: typeof job.lastError === "string" ? job.lastError.trim() || null : null,
  };
}

export function normalizePersistedScheduleJobs(value: unknown): ScheduleJob[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const jobs: ScheduleJob[] = [];
  for (const entry of value) {
    const job = normalizePersistedJob(entry);
    if (!job || seen.has(job.id)) continue;
    seen.add(job.id);
    jobs.push(job);
  }
  return jobs;
}

/** The enabled job in this workspace that is due first, or null when nothing is due. */
export function selectNextDueJob(
  jobs: ScheduleJob[],
  workspacePath: string,
  now = Date.now(),
): ScheduleJob | null {
  return (
    jobs
      .filter((job) => job.enabled && job.workspacePath === workspacePath && job.nextRunAt <= now)
      .sort((left, right) => left.nextRunAt - right.nextRunAt)[0] ?? null
  );
}

const useScheduleJobsStoreBase = create<ScheduleJobsState>()(
  persist(
    (set) => ({
      jobs: [],
      actions: {
        createJob: (input) => {
          const prompt = input.prompt.trim();
          const cron = input.cron.trim();
          const workspacePath = input.workspacePath.trim();
          if (!prompt || prompt.length > SCHEDULE_PROMPT_MAX_LENGTH) {
            throw new Error("Scheduled prompts must be between 1 and 20,000 characters.");
          }
          if (!isValidCron(cron)) {
            throw new Error(`"${cron}" is not a valid cron expression.`);
          }
          if (!workspacePath) {
            throw new Error("A scheduled task needs a workspace.");
          }
          const createdAt = Date.now();
          const nextRunAt = computeNextRunAt(cron, createdAt);
          if (nextRunAt === null) {
            throw new Error(`"${cron}" never runs.`);
          }
          const id = createJobId();
          const job: ScheduleJob = {
            id,
            prompt,
            cron: parseCron(cron).expression,
            workspacePath,
            enabled: true,
            createdAt,
            nextRunAt,
            lastRunAt: null,
            runCount: 0,
            lastError: null,
          };
          set((state) => ({ jobs: [job, ...state.jobs] }));
          return id;
        },
        deleteJob: (jobId) =>
          set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) })),
        setJobEnabled: (jobId, enabled) => {
          const now = Date.now();
          set((state) => ({
            jobs: state.jobs.map((job) => {
              if (job.id !== jobId) return job;
              if (!enabled) return { ...job, enabled: false };
              return {
                ...job,
                enabled: true,
                lastError: null,
                // Re-arm from now so a job disabled for months does not fire a burst.
                nextRunAt: computeNextRunAt(job.cron, now) ?? job.nextRunAt,
              };
            }),
          }));
        },
        claimDueJob: (workspacePath, now = Date.now(), expectedJobId) => {
          let claimedJob: ScheduleJob | null = null;
          set((state) => {
            const dueJob = selectNextDueJob(state.jobs, workspacePath, now);
            if (!dueJob) return state;
            if (expectedJobId && dueJob.id !== expectedJobId) return state;

            const nextRunAt = computeNextRunAt(dueJob.cron, now);
            claimedJob = {
              ...dueJob,
              lastRunAt: now,
              nextRunAt: nextRunAt ?? dueJob.nextRunAt,
              runCount: dueJob.runCount + 1,
              lastError: null,
              // An expression that can no longer match parks itself instead of spinning.
              enabled: nextRunAt !== null,
            };
            return {
              jobs: state.jobs.map((job) =>
                job.id === dueJob.id ? (claimedJob as ScheduleJob) : job,
              ),
            };
          });
          return claimedJob;
        },
        pauseJobForError: (jobId, reason) =>
          set((state) => ({
            jobs: state.jobs.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    enabled: false,
                    lastError: reason.trim() || "Unable to run the scheduled task.",
                  }
                : job,
            ),
          })),
      },
    }),
    {
      name: "blimy-schedule-jobs-v1",
      version: 1,
      storage: createSafeJSONStorage<PersistedScheduleJobsState>(),
      partialize: (state) => ({ jobs: state.jobs }),
      migrate: (persistedState) => {
        const persisted = persistedState as Partial<PersistedScheduleJobsState> | undefined;
        return { jobs: normalizePersistedScheduleJobs(persisted?.jobs) };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedScheduleJobsState> | undefined;
        return { ...currentState, jobs: normalizePersistedScheduleJobs(persisted?.jobs) };
      },
    },
  ),
);

export const useScheduleJobsStore = createSelectors(useScheduleJobsStoreBase);
