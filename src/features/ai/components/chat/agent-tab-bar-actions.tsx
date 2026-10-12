import { useMemo } from "react";
import { PlusIcon } from "@/ui/icons";
import { Button } from "@/ui/button";
import { useAIChatStore } from "../../stores/ai-chat.store";
import { useProjectStore } from "@/features/window/stores/project.store";
import { selectAgentSessions } from "@/features/ai/lib/agent-session-list";
import { canBrowseAgentSessions, openAgentSessions } from "@/features/ai/lib/open-agent-sessions";
import { selectAcpAgentStatus } from "@/features/ai/lib/acp-session-state";
import { useNewAgentAction } from "../../hooks/use-new-agent-action";
import { openAgentHistoryChat } from "@/features/ai/lib/open-agent-history";
import ChatHistoryDropdown from "../history/chat-history-dropdown";

interface AgentTabBarActionsProps {
  chatId: string;
}

export function AgentTabBarActions({ chatId }: AgentTabBarActionsProps) {
  const currentChatId = useAIChatStore((state) => state.currentChatId);
  const chats = useAIChatStore((state) => state.chats);
  const workspacePath = useProjectStore((state) => state.rootFolderPath || null);
  const selectedAgentId = useAIChatStore((state) => state.selectedAgentId);
  const setChatArchived = useAIChatStore((state) => state.actions.setChatArchived);

  const effectiveChatId = chatId ?? currentChatId;
  const currentChat = chats.find((chat) => chat.id === effectiveChatId);
  const currentAgentId = currentChat?.agentId ?? selectedAgentId;

  const handleNewAgent = useNewAgentAction({ agentId: currentAgentId });
  const canBrowseSessions = useAIChatStore((state) =>
    canBrowseAgentSessions(
      selectAcpAgentStatus(state, currentAgentId, workspacePath),
      currentAgentId,
    ),
  );

  const workspaceChats = useMemo(
    () => selectAgentSessions(chats, { workspacePath, keepIds: [effectiveChatId] }),
    [chats, effectiveChatId, workspacePath],
  );
  const archivedChats = useMemo(
    () => selectAgentSessions(chats, { workspacePath, includeArchived: "only" }),
    [chats, workspacePath],
  );

  return (
    <div className="flex items-center gap-0">
      <ChatHistoryDropdown
        chats={workspaceChats}
        archivedChats={archivedChats}
        currentChatId={effectiveChatId}
        onSwitchToChat={openAgentHistoryChat}
        onSetChatArchived={setChatArchived}
        onDeleteChat={() => {}}
        onBrowseAgentSessions={
          canBrowseSessions ? () => openAgentSessions(currentAgentId) : undefined
        }
      />
      <Button
        type="button"
        variant="ghost"
        iconOnly
        size="sm"
        onClick={handleNewAgent}
        tooltip="New Agent"
        commandId="workbench.agentLauncher"
        aria-label="New Agent"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
