import { openAgentWindowSession } from "@/features/ai/detached/agent-window-service";
import { openNewAgentChat } from "@/features/ai/lib/open-new-agent-chat";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { useUIState } from "@/features/window/stores/ui-state.store";

/**
 * Puts a pull request review into the agent composer as the next prompt. It
 * appends to the open chat, or opens a new one, so the review can be turned
 * into fixes without retyping it.
 */
export function sendReviewToAgentChat(markdown: string): string | null {
  const chatStore = useAIChatStore.getState();
  const currentChatId = chatStore.currentChatId;
  const currentChat = currentChatId
    ? chatStore.chats.find((candidate) => candidate.id === currentChatId)
    : undefined;

  const chatId =
    currentChatId && currentChat && !currentChat.archivedAt ? currentChatId : openNewAgentChat();

  if (!chatId) return null;

  const store = useAIChatStore.getState();
  const chat = store.chats.find((candidate) => candidate.id === chatId);
  store.actions.setPendingAgentLaunchRequest({
    chatId,
    agentId: chat?.agentId ?? store.actions.getCurrentAgentId(),
    prompt: markdown,
    selectedBufferIds: [],
    selectedFilesPaths: [],
    editorSelections: [],
    mode: "append",
  });

  const uiState = useUIState.getState();
  if (!openAgentWindowSession(chatId)) {
    uiState.setActiveRightSidebarView("agents");
    uiState.setIsRightSidebarVisible(true);
  }

  return chatId;
}
