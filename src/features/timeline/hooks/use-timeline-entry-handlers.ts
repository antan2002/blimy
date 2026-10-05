import { useCallback, useMemo, useState } from "react";
import { openCommitDiffBuffer } from "@/features/git/utils/open-commit-diff-buffer";
import {
  compareLocalHistoryWithCurrent,
  compareLocalHistoryWithPrevious,
  deleteLocalHistorySnapshot,
  openLocalHistorySnapshot,
  renameLocalHistorySnapshot,
  restoreLocalHistorySnapshot,
} from "@/features/local-history/actions/local-history-entry-actions";
import { getBaseName } from "@/utils/path-helpers";
import { useFileTimeline } from "./use-file-timeline";
import type { TimelineEntry } from "../utils/timeline-entries";

interface TimelineEntryHandlers {
  /** The primary action: open a commit diff, or open a saved snapshot. */
  open: (entry: TimelineEntry) => void;
  compareWithCurrent: (entry: TimelineEntry) => void;
  compareWithPrevious: (entry: TimelineEntry) => void;
  restore: (entry: TimelineEntry) => void;
  rename: (entry: TimelineEntry, label: string) => Promise<boolean>;
  remove: (entry: TimelineEntry) => void;
}

export function useTimelineEntryHandlers(
  repoPath: string | null,
  filePath: string | null,
  entries: TimelineEntry[],
): TimelineEntryHandlers {
  const fileName = useMemo(
    () => (filePath ? getBaseName(filePath, "file") : "Local History"),
    [filePath],
  );

  const open = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind === "commit") {
        if (!repoPath) return;
        void openCommitDiffBuffer({
          repoPath,
          commitHash: entry.commit.hash,
          message: entry.commit.message,
          description: entry.commit.description,
          author: entry.commit.author,
          email: entry.commit.email,
          date: entry.commit.date,
        });
        return;
      }

      if (!filePath) return;
      void openLocalHistorySnapshot(filePath, entry.snapshot, fileName);
    },
    [fileName, filePath, repoPath],
  );

  const compareWithCurrent = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind !== "snapshot" || !filePath) return;
      void compareLocalHistoryWithCurrent(filePath, entry.snapshot, fileName);
    },
    [fileName, filePath],
  );

  const compareWithPrevious = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind !== "snapshot" || !filePath) return;
      // The merged list is newest first, so the older neighbour is the next one.
      const index = entries.findIndex((candidate) => candidate.id === entry.id);
      const previousSnapshot =
        index < 0
          ? undefined
          : entries
              .slice(index + 1)
              .find((candidate) => candidate.kind === "snapshot")?.snapshot;
      void compareLocalHistoryWithPrevious(filePath, entry.snapshot, previousSnapshot, fileName);
    },
    [entries, fileName, filePath],
  );

  const restore = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind !== "snapshot" || !filePath) return;
      void restoreLocalHistorySnapshot(filePath, entry.snapshot);
    },
    [filePath],
  );

  const rename = useCallback(
    async (entry: TimelineEntry, label: string) => {
      if (entry.kind !== "snapshot" || !filePath) return false;
      return (await renameLocalHistorySnapshot(filePath, entry.snapshot, label)) !== null;
    },
    [filePath],
  );

  const remove = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind !== "snapshot" || !filePath) return;
      void deleteLocalHistorySnapshot(filePath, entry.snapshot);
    },
    [filePath],
  );

  return { open, compareWithCurrent, compareWithPrevious, restore, rename, remove };
}

export function useTimelineSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = useCallback((entry: TimelineEntry) => {
    if (entry.kind !== "snapshot") return;
    setRenamingId(entry.id);
    setRenameValue(entry.snapshot.label ?? "");
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
  }, []);

  return { selectedId, setSelectedId, renamingId, renameValue, setRenameValue, startRename, cancelRename };
}
