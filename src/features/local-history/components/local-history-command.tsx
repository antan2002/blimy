import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowsLeftRightIcon,
  EyeIcon,
  HistoryIcon,
  PenIcon,
  PlusIcon,
  TrashIcon,
} from "@/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import {
  compareLocalHistoryWithCurrent,
  compareLocalHistoryWithPrevious,
  createLocalHistorySnapshot,
  deleteLocalHistorySnapshot,
  openLocalHistorySnapshot,
  renameLocalHistorySnapshot,
  restoreLocalHistorySnapshot,
} from "@/features/local-history/actions/local-history-entry-actions";
import {
  listLocalHistoryFile,
  type LocalHistoryEntry,
} from "@/features/local-history/api/local-history-api";
import { useLocalHistoryStore } from "@/features/local-history/stores/local-history.store";
import {
  formatSnapshotDate,
  formatSnapshotSize,
  getEntryTitle,
} from "@/features/local-history/utils/local-history-format";
import { Button } from "@/ui/button";
import {
  CommandEmpty,
  CommandHeader,
  CommandHeaderAction,
  CommandInput,
  CommandList,
} from "@/ui/command";
import { InlineRenameInput } from "@/ui/input";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import { formatRelativeDate } from "@/utils/date";
import { getBaseName } from "@/utils/path-helpers";
import { matchesSearchQuery } from "@/utils/search-match";

interface LocalHistoryCommandContentProps {
  isActive: boolean;
  activeFilePath?: string | null;
  onBack: () => void;
  onClose: () => void;
}

export function LocalHistoryCommandContent({
  isActive,
  activeFilePath,
  onBack,
  onClose,
}: LocalHistoryCommandContentProps) {
  const storedTargetPath = useLocalHistoryStore.use.targetPath();
  const targetPath = storedTargetPath ?? activeFilePath ?? null;
  const fileName = targetPath ? getBaseName(targetPath, "file") : "Local History";
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LocalHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [renamingEntryId, setRenamingEntryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          !query.trim() ||
          matchesSearchQuery(query, [
            entry.file_name,
            entry.label ?? "",
            entry.reason,
            formatSnapshotDate(entry.created_at),
            formatRelativeDate(new Date(entry.created_at)),
          ]),
      ),
    [entries, query],
  );

  const loadEntries = useCallback(async () => {
    if (!targetPath) {
      setEntries([]);
      return;
    }

    setIsLoading(true);
    try {
      setEntries(await listLocalHistoryFile(targetPath));
    } catch (error) {
      console.error("Failed to load local history:", error);
      toast.error("Failed to load local history");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [targetPath]);

  useEffect(() => {
    if (!isActive) return;
    setQuery("");
    setSelectedIndex(0);
    void loadEntries();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isActive, loadEntries]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, targetPath]);

  useEffect(() => {
    if (!listRef.current || filteredEntries.length === 0) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [filteredEntries.length, selectedIndex]);

  const openSnapshot = useCallback(
    async (entry: LocalHistoryEntry) => {
      if (!targetPath) return;
      if (await openLocalHistorySnapshot(targetPath, entry, fileName)) {
        onClose();
      }
    },
    [fileName, onClose, targetPath],
  );

  const createSnapshot = useCallback(async () => {
    if (!targetPath) return;
    const entry = await createLocalHistorySnapshot(targetPath);
    if (entry) {
      setEntries((current) => [entry, ...current]);
    }
  }, [targetPath]);

  const compareWithCurrent = useCallback(
    async (entry: LocalHistoryEntry) => {
      if (!targetPath) return;
      if (await compareLocalHistoryWithCurrent(targetPath, entry, fileName)) {
        onClose();
      }
    },
    [fileName, onClose, targetPath],
  );

  const compareWithPrevious = useCallback(
    async (entry: LocalHistoryEntry) => {
      if (!targetPath) return;
      const entryIndex = entries.findIndex((candidate) => candidate.id === entry.id);
      const previousEntry = entryIndex >= 0 ? entries[entryIndex + 1] : undefined;
      if (await compareLocalHistoryWithPrevious(targetPath, entry, previousEntry, fileName)) {
        onClose();
      }
    },
    [entries, fileName, onClose, targetPath],
  );

  const restoreSnapshot = useCallback(
    async (entry: LocalHistoryEntry) => {
      if (!targetPath) return;
      if (await restoreLocalHistorySnapshot(targetPath, entry)) {
        onClose();
      }
    },
    [onClose, targetPath],
  );

  const deleteSnapshot = useCallback(
    async (entry: LocalHistoryEntry) => {
      if (!targetPath) return;
      if (await deleteLocalHistorySnapshot(targetPath, entry)) {
        setEntries((current) => current.filter((candidate) => candidate.id !== entry.id));
      }
    },
    [targetPath],
  );

  const renameSnapshot = useCallback(
    async (entry: LocalHistoryEntry, label: string) => {
      if (!targetPath) return;
      const updatedEntry = await renameLocalHistorySnapshot(targetPath, entry, label);
      if (updatedEntry) {
        setEntries((current) =>
          current.map((candidate) => (candidate.id === updatedEntry.id ? updatedEntry : candidate)),
        );
      }
      setRenamingEntryId(null);
      setRenameValue("");
    },
    [targetPath],
  );

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) =>
          current < filteredEntries.length - 1 ? current + 1 : current,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current > 0 ? current - 1 : current));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const entry = filteredEntries[selectedIndex];
        if (entry) void openSnapshot(entry);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredEntries, isActive, openSnapshot, selectedIndex]);

  return (
    <>
      <CommandHeader onClose={onClose}>
        <CommandHeaderAction aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </CommandHeaderAction>
        <HistoryIcon className="size-4 shrink-0 text-subtle-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans ui-text-base text-foreground">
            Local History: {fileName}
          </div>
          <div className="truncate font-sans ui-text-base text-subtle-foreground">{targetPath}</div>
        </div>
        <CommandHeaderAction
          aria-label="Create local history entry"
          onClick={() => void createSnapshot()}
          tooltip="Create entry"
        >
          <PlusIcon />
        </CommandHeaderAction>
      </CommandHeader>

      <div className="border-border border-b px-4 py-2">
        <CommandInput
          ref={inputRef}
          value={query}
          onChange={setQuery}
          placeholder="Search timeline..."
        />
      </div>

      <CommandList ref={listRef}>
        {!targetPath ? (
          <CommandEmpty>No local file selected</CommandEmpty>
        ) : isLoading ? (
          <CommandEmpty>Loading timeline...</CommandEmpty>
        ) : filteredEntries.length === 0 ? (
          <CommandEmpty>No local history snapshots</CommandEmpty>
        ) : (
          filteredEntries.map((entry, index) => (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => void openSnapshot(entry)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "mb-1 flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                index === selectedIndex
                  ? "bg-selected text-foreground"
                  : "bg-transparent text-foreground",
              )}
            >
              <HistoryIcon className="size-4 shrink-0 text-subtle-foreground" />
              <div className="min-w-0 flex-1">
                {renamingEntryId === entry.id ? (
                  <InlineRenameInput
                    value={renameValue}
                    onValueChange={setRenameValue}
                    onSubmit={(label) => void renameSnapshot(entry, label)}
                    onCancel={() => {
                      setRenamingEntryId(null);
                      setRenameValue("");
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    allowEmpty
                    aria-label={`Rename ${getEntryTitle(entry)}`}
                    placeholder="Entry name"
                  />
                ) : (
                  <div className="truncate font-sans ui-text-base text-foreground">
                    {getEntryTitle(entry)}
                  </div>
                )}
                <div className="truncate font-sans ui-text-base text-subtle-foreground">
                  {formatRelativeDate(new Date(entry.created_at))} ·{" "}
                  {formatSnapshotSize(entry.size)}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  tooltip="Open snapshot"
                  onClick={(event) => {
                    event.stopPropagation();
                    void openSnapshot(entry);
                  }}
                  iconOnly
                >
                  <EyeIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  tooltip="Compare with current"
                  onClick={(event) => {
                    event.stopPropagation();
                    void compareWithCurrent(entry);
                  }}
                  iconOnly
                >
                  <ArrowsLeftRightIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  tooltip="Compare with previous"
                  onClick={(event) => {
                    event.stopPropagation();
                    void compareWithPrevious(entry);
                  }}
                  iconOnly
                >
                  <HistoryIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  tooltip="Restore snapshot"
                  onClick={(event) => {
                    event.stopPropagation();
                    void restoreSnapshot(entry);
                  }}
                  iconOnly
                >
                  <ArrowCounterClockwiseIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  tooltip="Rename snapshot"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenamingEntryId(entry.id);
                    setRenameValue(entry.label ?? "");
                  }}
                  iconOnly
                >
                  <PenIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  tone="danger"
                  tooltip="Delete snapshot"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteSnapshot(entry);
                  }}
                  iconOnly
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
          ))
        )}
      </CommandList>
    </>
  );
}
