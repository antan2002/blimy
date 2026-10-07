import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { getBufferById } from "@/features/editor/utils/buffer-index";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { isGitChangeRelevant, subscribeToGitChanges } from "@/features/git/events/git-events";
import { getGitLogForPath } from "@/features/git/api/git-commits-api";
import { useGitStore } from "@/features/git/stores/git.store";
import type { GitCommit } from "@/features/git/types/git.types";
import {
  listLocalHistoryFile,
  type LocalHistoryEntry,
} from "@/features/local-history/api/local-history-api";
import { mergeTimelineEntries, type TimelineEntry } from "../utils/timeline-entries";

export function useFileTimeline(enabled: boolean) {
  const filePath = useBufferStore(
    useShallow((state) => {
      const buffer = state.activeBufferId
        ? getBufferById(state.buffers, state.activeBufferId)
        : null;
      if (buffer?.type !== "editor" || buffer.isVirtual) return null;
      return buffer.path || null;
    }),
  );

  const workspaceRepoPath = useGitStore((state) => state.currentWorkspaceRepoPath);
  const activeRepoPath = useGitStore((state) => state.currentRepoPath);
  const rootFolderPath = useFileSystemStore.use.rootFolderPath?.();
  const repoPath = workspaceRepoPath ?? activeRepoPath ?? rootFolderPath ?? null;

  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [snapshots, setSnapshots] = useState<LocalHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !filePath) {
      setCommits([]);
      setSnapshots([]);
      return;
    }

    setIsLoading(true);

    // The two sources are independent, so one failing must not hide the other.
    // `getGitLogForPath` swallows its own failures and reports an empty list, so
    // it cannot reject; only the snapshot read can.
    const [gitCommits, fileSnapshots] = await Promise.all([
      repoPath ? getGitLogForPath(repoPath, filePath) : Promise.resolve<GitCommit[]>([]),
      listLocalHistoryFile(filePath).catch((error) => {
        console.error("Failed to load local history for timeline:", error);
        return [] as LocalHistoryEntry[];
      }),
    ]);

    setCommits(gitCommits);
    setSnapshots(fileSnapshots);
    setIsLoading(false);
  }, [enabled, filePath, repoPath]);

  useEffect(() => {
    void load();
  }, [load]);

  // A commit or a save changes what this file's timeline should show, and the
  // timeline is not the surface that triggered it.
  useEffect(() => {
    if (!enabled) return;

    return subscribeToGitChanges((change) => {
      const touchesHistory = change.scopes?.includes("history") ?? false;
      if (!touchesHistory && !isGitChangeRelevant(change, repoPath, filePath)) return;
      void load();
    });
  }, [enabled, filePath, load, repoPath]);

  const entries = useMemo<TimelineEntry[]>(
    () => mergeTimelineEntries(commits, snapshots),
    [commits, snapshots],
  );

  return {
    filePath,
    repoPath,
    hasRepo: Boolean(repoPath),
    entries,
    isLoading,
    refresh: load,
  };
}
