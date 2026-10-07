import { memo } from "react";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { useSidebarStore } from "@/features/layout/stores/sidebar.store";
import { EmptyState } from "@/ui/empty";
import { SidebarPanel } from "@/ui/sidebar";
import { Spinner } from "@/ui/spinner";
import { FileExplorerTree } from "./file-explorer-tree";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/ui/accordion";
import { OutlineSidebar } from "@/features/outline/components/outline-sidebar";
import { TimelineSidebar } from "@/features/timeline/components/timeline-sidebar";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { useSettingsStore } from "@/features/settings/stores/settings.store";

function FileExplorerPaneComponent() {
  const setFiles = useFileSystemStore.use.setFiles?.();
  const handleCreateNewFolderInDirectory =
    useFileSystemStore.use.handleCreateNewFolderInDirectory?.();
  const handleFileSelect = useFileSystemStore.use.handleFileSelect?.();
  const handleFileOpen = useFileSystemStore.use.handleFileOpen?.();
  const handleCreateNewFileInDirectory = useFileSystemStore.use.handleCreateNewFileInDirectory?.();
  const handleDeletePath = useFileSystemStore.use.handleDeletePath?.();
  const refreshDirectory = useFileSystemStore.use.refreshDirectory?.();
  const handleFileMove = useFileSystemStore.use.handleFileMove?.();
  const handleRevealInFolder = useFileSystemStore.use.handleRevealInFolder?.();
  const handleDuplicatePath = useFileSystemStore.use.handleDuplicatePath?.();
  const handleRenamePath = useFileSystemStore.use.handleRenamePath?.();

  const rootFolderPath = useFileSystemStore.use.rootFolderPath?.();
  const files = useFileSystemStore.use.files();
  const isFileTreeLoading = useFileSystemStore.use.isFileTreeLoading();
  const isSwitchingProject = useFileSystemStore.use.isSwitchingProject();
  const activeBufferId = useBufferStore.use.activeBufferId();
  // The docked outline honours this setting, so the accordion must too or the
  // same setting means two different things.
  const showOutline = useSettingsStore((state) => state.settings.showOutline);

  const activePath = useSidebarStore.use.activePath?.();
  const updateActivePath = useSidebarStore.use.actions().updateActivePath;

  return (
    <SidebarPanel className="relative p-0 flex flex-col h-full">
      <Accordion
        defaultValue={["folders", "outline"]}
        className="flex-1 overflow-hidden flex flex-col h-full"
      >
        <AccordionItem
          value="folders"
          className="flex flex-col min-h-0 shrink-0 has-[[aria-expanded=true]]:flex-1 [&>[data-slot=accordion-content]]:flex-1 [&>[data-slot=accordion-content]]:flex [&>[data-slot=accordion-content]]:flex-col [&>[data-slot=accordion-content]]:min-h-0"
        >
          <AccordionTrigger className="uppercase text-xs font-semibold">Folders</AccordionTrigger>
          <AccordionContent className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
            {(!isFileTreeLoading || isSwitchingProject) && (
              <FileExplorerTree
                files={files}
                activePath={activePath}
                updateActivePath={updateActivePath}
                rootFolderPath={rootFolderPath}
                onFileSelect={handleFileSelect}
                onFileOpen={handleFileOpen}
                onCreateNewFileInDirectory={handleCreateNewFileInDirectory}
                onCreateNewFolderInDirectory={handleCreateNewFolderInDirectory}
                onDeletePath={handleDeletePath}
                onUpdateFiles={setFiles}
                onRefreshDirectory={refreshDirectory}
                onRenamePath={handleRenamePath}
                onRevealInFinder={handleRevealInFolder}
                onFileMove={handleFileMove}
                onDuplicatePath={handleDuplicatePath}
              />
            )}

            {isFileTreeLoading && !isSwitchingProject && (
              <EmptyState
                layout="sidebar"
                message={<Spinner label="Loading files" showLabel compact />}
              />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="outline"
          className="flex flex-col min-h-0 shrink-0 has-[[aria-expanded=true]]:flex-1 border-t border-border [&>[data-slot=accordion-content]]:flex-1 [&>[data-slot=accordion-content]]:flex [&>[data-slot=accordion-content]]:flex-col [&>[data-slot=accordion-content]]:min-h-0"
        >
          <AccordionTrigger
            className="uppercase text-xs font-semibold"
            disabled={!activeBufferId || !showOutline}
          >
            Outline
          </AccordionTrigger>
          <AccordionContent className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative">
            {!showOutline ? (
              <EmptyState message="Outline is hidden in settings" layout="sidebar" />
            ) : activeBufferId ? (
              <OutlineSidebar bufferId={activeBufferId} />
            ) : (
              <EmptyState message="No active editor" layout="sidebar" />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="timeline"
          className="flex flex-col min-h-0 shrink-0 has-[[aria-expanded=true]]:flex-1 border-t border-border [&>[data-slot=accordion-content]]:flex-1 [&>[data-slot=accordion-content]]:flex [&>[data-slot=accordion-content]]:flex-col [&>[data-slot=accordion-content]]:min-h-0"
        >
          <AccordionTrigger className="uppercase text-xs font-semibold" disabled={!activeBufferId}>
            Timeline
          </AccordionTrigger>
          <AccordionContent className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden relative">
            <TimelineSidebar isActive={activeBufferId !== null} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </SidebarPanel>
  );
}

export const FileExplorerPane = memo(FileExplorerPaneComponent);
