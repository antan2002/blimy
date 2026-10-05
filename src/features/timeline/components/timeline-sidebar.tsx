import { useMemo } from "react";
import { EmptyState } from "@/ui/empty";
import { SidebarListItem, SidebarScrollArea, SidebarSection } from "@/ui/sidebar";
import { Spinner } from "@/ui/spinner";
import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  DotsIcon,
  EyeIcon,
  GitBranchIcon,
  HistoryIcon,
  PenIcon,
  TrashIcon,
} from "@/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItems,
  DropdownMenuTrigger,
  menuSeparator,
  type MenuItem,
} from "@/ui/dropdown";
import { InlineRenameInput } from "@/ui/input";
import { formatShortDateTime } from "@/utils/date";
import { getEntryTitle } from "@/features/local-history/utils/local-history-format";
import { useFileTimeline } from "../hooks/use-file-timeline";
import {
  useTimelineEntryHandlers,
  useTimelineSelection,
} from "../hooks/use-timeline-entry-handlers";
import { describeTimelineEntry, groupTimelineByDay, type TimelineEntry } from "../utils/timeline-entries";

function TimelineEntryMenu({
  entry,
  handlers,
  onRename,
}: {
  entry: TimelineEntry;
  handlers: ReturnType<typeof useTimelineEntryHandlers>;
  onRename: (entry: TimelineEntry) => void;
}) {
  const items = useMemo<MenuItem[]>(() => {
    if (entry.kind === "commit") {
      return [
        {
          id: "open",
          label: "Open commit",
          icon: <GitBranchIcon />,
          onClick: () => handlers.open(entry),
        },
      ];
    }

    return [
      {
        id: "compare-current",
        label: "Compare with current",
        icon: <EyeIcon />,
        onClick: () => handlers.compareWithCurrent(entry),
      },
      {
        id: "compare-previous",
        label: "Compare with previous",
        icon: <ArrowsLeftRightIcon />,
        onClick: () => handlers.compareWithPrevious(entry),
      },
      {
        id: "restore",
        label: "Restore this version",
        icon: <ArrowCounterClockwiseIcon />,
        onClick: () => handlers.restore(entry),
      },
      menuSeparator("rename-separator"),
      {
        id: "rename",
        label: "Rename",
        icon: <PenIcon />,
        onClick: () => onRename(entry),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <TrashIcon />,
        tone: "destructive",
        onClick: () => handlers.remove(entry),
      },
    ];
  }, [entry, handlers, onRename]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        aria-label={`Actions for ${describeTimelineEntry(entry).title}`}
        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-subtle-foreground transition-colors hover:bg-accent-foreground/10 hover:text-foreground"
      >
        <DotsIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" size="compact">
        <DropdownMenuItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TimelineSidebar({ isActive = true }: { isActive?: boolean }) {
  const { filePath, repoPath, entries, isLoading, hasRepo } = useFileTimeline(isActive);
  const handlers = useTimelineEntryHandlers(repoPath, filePath, entries);
  const { selectedId, setSelectedId, renamingId, renameValue, setRenameValue, startRename, cancelRename } =
    useTimelineSelection();

  const groups = useMemo(() => groupTimelineByDay(entries), [entries]);

  if (!filePath) {
    return <EmptyState message="Open a file to see its timeline" layout="sidebar" />;
  }

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Spinner label="Loading timeline" showLabel compact />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        layout="sidebar"
        message={
          hasRepo
            ? "No commits or saved versions for this file yet"
            : "No saved versions for this file, and it is not in a repository"
        }
      />
    );
  }

  return (
    <SidebarScrollArea className="flex-1 min-h-0">
      {groups.map((group) => (
        <SidebarSection
          key={group.day}
          title={formatShortDateTime(new Date(group.entries[0].at))}
          count={group.entries.length}
        >
          {group.entries.map((entry) => {
            const { title, description } = describeTimelineEntry(entry);
            const isRenaming = renamingId === entry.id;

            return (
              <SidebarListItem
                key={entry.id}
                density="compact"
                active={selectedId === entry.id}
                leading={
                  entry.kind === "commit" ? (
                    <GitBranchIcon className="size-3.5" />
                  ) : (
                    <HistoryIcon className="size-3.5" />
                  )
                }
                trailing={
                  <TimelineEntryMenu entry={entry} handlers={handlers} onRename={startRename} />
                }
                onClick={() => {
                  setSelectedId(entry.id);
                  handlers.open(entry);
                }}
                description={description}
              >
                {isRenaming && entry.kind === "snapshot" ? (
                  <InlineRenameInput
                    value={renameValue}
                    onValueChange={setRenameValue}
                    onSubmit={async (label) => {
                      await handlers.rename(entry, label);
                      cancelRename();
                    }}
                    onCancel={cancelRename}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    allowEmpty
                    aria-label={`Rename ${getEntryTitle(entry.snapshot)}`}
                    placeholder="Version name"
                  />
                ) : (
                  title
                )}
              </SidebarListItem>
            );
          })}
        </SidebarSection>
      ))}
    </SidebarScrollArea>
  );
}
