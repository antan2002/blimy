import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { CodexIntegrationService } from "@/features/ai/integrations/codex/codex-integration-service";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import type { AgentConfig } from "@/features/ai/types/acp.types";
import type { AgentType } from "@/features/ai/types/ai-chat.types";
import {
  selectNextDueJob,
  useScheduleJobsStore,
} from "@/features/ai/scheduling/schedule-job.store";
import {
  buildScheduleJobPrompt,
  runNextDueScheduleJob,
} from "@/features/ai/scheduling/schedule-job-runner";
import { useUIState } from "@/features/window/stores/ui-state.store";
import { useProjectStore } from "@/features/window/stores/project.store";
import {
  buildContinuousAgentPrompt,
  checkContinuousAgentReadiness,
  runNextDueContinuousAgent,
} from "./continuous-agent-runner";
import { selectNextDueContinuousAgent, useContinuousAgentsStore } from "./continuous-agents.store";

const CONTINUOUS_AGENT_CHECK_INTERVAL_MS = 30_000;
const CONTINUOUS_AGENT_SCHEDULER_LOCK = "blimy-continuous-agent-scheduler";

function isAgentBusy() {
  const chatState = useAIChatStore.getState();
  return Boolean(
    chatState.pendingAgentLaunchRequest || Object.keys(chatState.agentRuns).length > 0,
  );
}

/** Opens a fresh Agent session holding the prompt, and returns its chat id. */
function launchAgentPrompt(agentId: AgentType, prompt: string) {
  const chatState = useAIChatStore.getState();
  const chatId = chatState.actions.createNewChat(agentId, { activate: false });
  try {
    chatState.actions.setPendingAgentLaunchRequest({
      chatId,
      agentId,
      prompt,
      selectedBufferIds: [],
      selectedFilesPaths: [],
      editorSelections: [],
    });
    chatState.actions.switchToChat(chatId);
    const uiState = useUIState.getState();
    uiState.setActiveRightSidebarView("agents");
    uiState.setIsRightSidebarVisible(true);
  } catch (error) {
    chatState.actions.setPendingAgentLaunchRequest(null);
    chatState.actions.deleteChat(chatId);
    throw error;
  }
  return chatId;
}

export function ContinuousAgentsRuntime() {
  const workspacePath = useProjectStore((state) => state.rootFolderPath ?? null);
  const tasks = useContinuousAgentsStore((state) => state.tasks);
  const jobs = useScheduleJobsStore((state) => state.jobs);
  const runningRef = useRef(false);

  const runNextDueRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const run = async () => {
        await useContinuousAgentsStore.persist.rehydrate();
        await useScheduleJobsStore.persist.rehydrate();

        const continuous = await runNextDueContinuousAgent({
          getWorkspacePath: () => useProjectStore.getState().rootFolderPath ?? null,
          isAgentBusy,
          getDueTask: (currentWorkspacePath, now) =>
            selectNextDueContinuousAgent(
              useContinuousAgentsStore.getState().tasks,
              currentWorkspacePath,
              now,
            ),
          checkReadiness: (task) =>
            checkContinuousAgentReadiness(task, {
              loadAcpAgents: () => invoke<AgentConfig[]>("get_available_agents"),
              loadCodexStatus: () => CodexIntegrationService.status(),
            }),
          claimTask: (currentWorkspacePath, now, taskId) =>
            useContinuousAgentsStore
              .getState()
              .actions.claimDueTask(currentWorkspacePath, now, taskId),
          launchTask: (task) => {
            const chatId = launchAgentPrompt(
              task.agentId,
              buildContinuousAgentPrompt(task.name, task.prompt),
            );
            useContinuousAgentsStore.getState().actions.attachChat(task.id, chatId);
          },
          pauseTask: (taskId, reason) => {
            useContinuousAgentsStore.getState().actions.pauseTaskForError(taskId, reason);
          },
        });

        // One run at a time: a goal that just started keeps the agent busy, so a due timer is
        // picked up on the next tick instead of colliding with it.
        if (continuous.status === "started" || continuous.status === "paused") {
          return { continuous };
        }

        const scheduled = runNextDueScheduleJob({
          getWorkspacePath: () => useProjectStore.getState().rootFolderPath ?? null,
          isAgentBusy,
          getDueJob: (currentWorkspacePath, now) =>
            selectNextDueJob(useScheduleJobsStore.getState().jobs, currentWorkspacePath, now),
          claimJob: (currentWorkspacePath, now, jobId) =>
            useScheduleJobsStore.getState().actions.claimDueJob(currentWorkspacePath, now, jobId),
          launchJob: (job) =>
            launchAgentPrompt(
              useAIChatStore.getState().selectedAgentId,
              buildScheduleJobPrompt(job.prompt),
            ),
          pauseJob: (jobId, reason) => {
            useScheduleJobsStore.getState().actions.pauseJobForError(jobId, reason);
          },
        });
        return { continuous, scheduled };
      };

      const lockManager = globalThis.navigator?.locks;
      const outcome = lockManager
        ? await lockManager.request(
            CONTINUOUS_AGENT_SCHEDULER_LOCK,
            { ifAvailable: true },
            (lock) => (lock ? run() : null),
          )
        : await run();

      if (!outcome) return;

      const { continuous, scheduled } = outcome;

      if (continuous.status === "started") {
        toast.success(`${continuous.task.name} started`, {
          description: "The run is open in a fresh Agent session.",
        });
      } else if (continuous.status === "paused") {
        toast.error(`${continuous.task.name} was paused`, {
          description: continuous.reason,
        });
      }

      if (scheduled?.status === "started") {
        toast.success("Scheduled task started", {
          description: scheduled.job.prompt,
        });
      } else if (scheduled?.status === "paused") {
        toast.error("Scheduled task was paused", {
          description: scheduled.reason,
        });
      }
    } catch (error) {
      console.error("Failed to run a due agent task:", error);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void runNextDueRun(), 100);
    return () => window.clearTimeout(timeout);
  }, [runNextDueRun, tasks, jobs, workspacePath]);

  useEffect(() => {
    const interval = window.setInterval(
      () => void runNextDueRun(),
      CONTINUOUS_AGENT_CHECK_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [runNextDueRun]);

  return null;
}
