import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { agentIsDetached } from "@/features/ai/detached/agent-window.store";
import {
  focusAgentWindow,
  openAgentWindowSession,
} from "@/features/ai/detached/agent-window-service";
import { useUIState } from "@/features/window/stores/ui-state.store";

export function openAgentHistoryChat(chatId: string): string {
  if (agentIsDetached(chatId)) {
    focusAgentWindow(chatId);
    return chatId;
  }
  const chatStore = useAIChatStore.getState();
  const chat = chatStore.actions.getChatById(chatId);
  const isPendingLaunch = chatStore.pendingAgentLaunchRequest?.chatId === chatId;

  if (chat && chat.messages.length === 0 && !isPendingLaunch) {
    void chatStore.actions.loadChatMessages(chatId);
  }

  chatStore.actions.switchToChat(chatId);

  const uiState = useUIState.getState();
  if (!openAgentWindowSession(chatId)) {
    uiState.setActiveRightSidebarView("agents");
    uiState.setIsRightSidebarVisible(true);
  }

  return chatId;
}
