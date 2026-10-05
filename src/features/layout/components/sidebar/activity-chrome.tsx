import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openFolder } from "@/features/file-system/controllers/platform";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { AppUpdateControl } from "@/features/layout/components/app-update-control";
import RunActionsButton from "@/features/run-actions/components/run-actions-button";
import { toggleTerminalPane } from "@/features/keymaps/commands/view-command-actions";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { AccountMenu } from "@/features/window/components/account-menu";
import ProjectPicker from "@/features/window/components/project-picker";
import WindowMenuBar from "@/features/window/components/window-menu-bar";
import { useUIState } from "@/features/window/stores/ui-state.store";
import { useWorkspaceTabsStore } from "@/features/window/stores/workspace-tabs.store";
import { createAppWindow } from "@/features/window/utils/create-app-window";
import { Button } from "@/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/ui/context-menu";
import {
  FilesIcon,
  FolderOpenIcon,
  ListIcon,
  TerminalWindowIcon,
  TrashIcon,
  WindowExpandIcon,
} from "@/ui/icons";
import { SidebarIconButton } from "@/ui/sidebar";
import Tooltip from "@/ui/tooltip";
import { IS_MAC } from "@/utils/platform";

export function ActivityChrome() {
  const handleOpenFolder = useFileSystemStore((state) => state.handleOpenFolder);
  const closeProject = useFileSystemStore((state) => state.closeProject);
  const projectTabs = useWorkspaceTabsStore.use.projectTabs();
  const openProjectPicker = useUIState((state) => state.openProjectPicker);
  const isProjectPickerVisible = useUIState((state) => state.isProjectPickerVisible);
  const projectPickerInitialStep = useUIState((state) => state.projectPickerInitialStep);
  const setIsProjectPickerVisible = useUIState((state) => state.setIsProjectPickerVisible);
  const [menuBarActiveMenu, setMenuBarActiveMenu] = useState<string | null>(null);
  const [isCompactMenuVisible, setIsCompactMenuVisible] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);

  const handleCloseAllProjects = useCallback(async () => {
    for (const tab of useWorkspaceTabsStore.getState().projectTabs) {
      await closeProject(tab.id);
    }
  }, [closeProject]);

  return (
    <>
      {createPortal(
        isProjectPickerVisible ? (
          <ProjectPicker
            isOpen
            initialStep={projectPickerInitialStep}
            onClose={() => setIsProjectPickerVisible(false)}
          />
        ) : null,
        document.body,
      )}
    </>
  );
}

function TerminalToggle() {
  const isTerminalOpen = useUIState(
    (state) => state.isBottomPaneVisible && state.bottomPaneActiveTab === "terminal",
  );
  return (
    <SidebarIconButton
      size="lg"
      active={isTerminalOpen}
      onClick={toggleTerminalPane}
      tooltip={isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
      commandId="workbench.toggleTerminal"
      aria-label={isTerminalOpen ? "Hide terminal" : "Show terminal"}
      aria-pressed={isTerminalOpen}
    >
      <TerminalWindowIcon />
    </SidebarIconButton>
  );
}

export function ActivityChromeFooter() {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex flex-col items-center gap-1">
        <AppUpdateControl compact />
      </div>
      <AccountMenu />
    </div>
  );
}
