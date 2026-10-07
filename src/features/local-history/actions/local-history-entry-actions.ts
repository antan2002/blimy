import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { readFile, writeFile } from "@/features/file-system/controllers/platform";
import { emitGitChanged } from "@/features/git/events/git-events";
import { createLocalHistoryDiff } from "@/features/local-history/utils/local-history-diff";
import { showPromptDialog } from "@/ui/dialog";
import { toast } from "sonner";
import {
  deleteLocalHistoryEntry,
  readLocalHistoryEntry,
  recordLocalHistoryFile,
  renameLocalHistoryEntry,
  type LocalHistoryEntry,
} from "../api/local-history-api";
import { formatSnapshotDate, getEntryTitle } from "../utils/local-history-format";

/**
 * Local history entry operations, shared by the command palette view and the
 * file timeline. Each one owns its own toast and error logging and returns
 * whether it changed anything, so a caller can refresh or close without
 * re-implementing the failure path.
 */

async function getCurrentContent(targetPath: string): Promise<string> {
  const buffer = useBufferStore
    .getState()
    .buffers.find((candidate) => candidate.type === "editor" && candidate.path === targetPath);
  if (buffer?.type === "editor") return buffer.content;

  return readFile(targetPath);
}

export async function openLocalHistoryDiff(
  targetPath: string,
  params: { title: string; oldContent: string; newContent: string },
): Promise<boolean> {
  if (params.oldContent === params.newContent) {
    toast.info("No changes to compare.");
    return false;
  }

  const diff = createLocalHistoryDiff({
    filePath: targetPath,
    oldContent: params.oldContent,
    newContent: params.newContent,
  });

  useBufferStore
    .getState()
    .actions.openBuffer(
      `diff://local-history/${Date.now()}/${encodeURIComponent(targetPath)}`,
      params.title,
      "",
      false,
      undefined,
      true,
      true,
      diff,
    );
  return true;
}

export async function openLocalHistorySnapshot(
  targetPath: string,
  entry: LocalHistoryEntry,
  fileName: string,
): Promise<boolean> {
  try {
    const content = await readLocalHistoryEntry(targetPath, entry.id);
    useBufferStore
      .getState()
      .actions.openBuffer(
        `local-history://${entry.id}/${encodeURIComponent(targetPath)}`,
        `${fileName} (${formatSnapshotDate(entry.created_at)})`,
        content,
        false,
        undefined,
        false,
        true,
      );
    return true;
  } catch (error) {
    console.error("Failed to open local history snapshot:", error);
    toast.error("Failed to open snapshot");
    return false;
  }
}

export async function compareLocalHistoryWithCurrent(
  targetPath: string,
  entry: LocalHistoryEntry,
  fileName: string,
): Promise<boolean> {
  try {
    const [snapshotContent, currentContent] = await Promise.all([
      readLocalHistoryEntry(targetPath, entry.id),
      getCurrentContent(targetPath),
    ]);

    return await openLocalHistoryDiff(targetPath, {
      title: `${fileName}: ${getEntryTitle(entry)} vs Current`,
      oldContent: snapshotContent,
      newContent: currentContent,
    });
  } catch (error) {
    console.error("Failed to compare local history snapshot:", error);
    toast.error("Failed to compare snapshot");
    return false;
  }
}

export async function compareLocalHistoryWithPrevious(
  targetPath: string,
  entry: LocalHistoryEntry,
  previousEntry: LocalHistoryEntry | undefined,
  fileName: string,
): Promise<boolean> {
  if (!previousEntry) {
    toast.info("No previous local history entry.");
    return false;
  }

  try {
    const [previousContent, snapshotContent] = await Promise.all([
      readLocalHistoryEntry(targetPath, previousEntry.id),
      readLocalHistoryEntry(targetPath, entry.id),
    ]);

    return await openLocalHistoryDiff(targetPath, {
      title: `${fileName}: ${getEntryTitle(previousEntry)} vs ${getEntryTitle(entry)}`,
      oldContent: previousContent,
      newContent: snapshotContent,
    });
  } catch (error) {
    console.error("Failed to compare local history snapshots:", error);
    toast.error("Failed to compare snapshots");
    return false;
  }
}

export async function restoreLocalHistorySnapshot(
  targetPath: string,
  entry: LocalHistoryEntry,
): Promise<boolean> {
  try {
    const content = await readLocalHistoryEntry(targetPath, entry.id);
    await recordLocalHistoryFile(targetPath, "restore");
    await writeFile(targetPath, content);

    const bufferStore = useBufferStore.getState();
    const openBuffer = bufferStore.buffers.find(
      (buffer) => buffer.type === "editor" && buffer.path === targetPath,
    );
    if (openBuffer) {
      bufferStore.actions.updateBufferContent(openBuffer.id, content, false);
      bufferStore.actions.markBufferDirty(openBuffer.id, false);
    }

    emitGitChanged({
      filePath: targetPath,
      scopes: ["working-tree"],
      source: "restore-local-history",
    });
    toast.success("Snapshot restored");
    return true;
  } catch (error) {
    console.error("Failed to restore local history snapshot:", error);
    toast.error("Failed to restore snapshot");
    return false;
  }
}

export async function deleteLocalHistorySnapshot(
  targetPath: string,
  entry: LocalHistoryEntry,
): Promise<boolean> {
  try {
    await deleteLocalHistoryEntry(targetPath, entry.id);
    return true;
  } catch (error) {
    console.error("Failed to delete local history snapshot:", error);
    toast.error("Failed to delete snapshot");
    return false;
  }
}

export async function renameLocalHistorySnapshot(
  targetPath: string,
  entry: LocalHistoryEntry,
  label: string,
): Promise<LocalHistoryEntry | null> {
  try {
    return await renameLocalHistoryEntry(targetPath, entry.id, label.trim() || null);
  } catch (error) {
    console.error("Failed to rename local history snapshot:", error);
    toast.error("Failed to rename snapshot");
    return null;
  }
}

/** Prompts for a label, then snapshots. Returns the new entry or null. */
export async function createLocalHistorySnapshot(
  targetPath: string,
): Promise<LocalHistoryEntry | null> {
  const label = await showPromptDialog("Name this local history entry:", {
    title: "Create Local History Entry",
    placeholder: "Optional name",
    confirmLabel: "Create",
  });
  if (label === null) return null;

  try {
    const entry = await recordLocalHistoryFile(targetPath, "manual", label.trim() || undefined);
    if (!entry) {
      toast.info("No file changes to snapshot.");
      return null;
    }
    toast.success("Local history entry created");
    return entry;
  } catch (error) {
    console.error("Failed to create local history snapshot:", error);
    toast.error("Failed to create snapshot");
    return null;
  }
}
