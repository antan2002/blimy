import { openAgentWindowSession } from "@/features/ai/detached/agent-window-service";
import { openNewAgentChat } from "@/features/ai/lib/open-new-agent-chat";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { useUIState } from "@/features/window/stores/ui-state.store";

/**
 * Sends a pull request review to the agent chat as the next prompt, then reveals
 * that chat so the review can be turned into fixes without retyping it.
 *
 * Two things must both be true for the chat surface to send the prompt:
 *
 * 1. `mode` is left unset. `mode: "append"` only merges context (buffers,
 *    files, selections) into the composer and returns before the prompt is
 *    read, so a review sent that way is dropped silently.
 * 2. The chat's agent buffer is the active buffer. The send effect bails out
 *    unless `activeBuffer.type === "agent"` and its `sessionId` matches the
 *    chat, so revealing the sidebar is not enough — the buffer has to be
 *    opened. `openNewAgentChat` does that; opening the sidebar alone does not.
 */
export function sendReviewToAgentChat(markdown: string): string | null {
  const prompt = markdown.trim();
  if (prompt === "") return null;

  const chatStore = useAIChatStore.getState();
  const currentChatId = chatStore.currentChatId;
  const currentChat = currentChatId
    ? chatStore.chats.find((candidate) => candidate.id === currentChatId)
    : undefined;
  const reusableChatId =
    currentChatId && currentChat && !currentChat.archivedAt ? currentChatId : null;

  // No chat to reuse: let the existing helper create one. It opens and activates
  // the agent buffer, which is what the composer needs before a prompt is sent.
  const chatId = reusableChatId ? revealExistingChat(reusableChatId) : openNewAgentChat();

  if (!chatId) return null;

  const store = useAIChatStore.getState();
  const chat = store.chats.find((candidate) => candidate.id === chatId);
  store.actions.setPendingAgentLaunchRequest({
    chatId,
    agentId: chat?.agentId ?? store.actions.getCurrentAgentId(),
    prompt,
    selectedBufferIds: [],
    selectedFilesPaths: [],
    editorSelections: [],
  });

  return chatId;
}

/**
 * Brings an existing chat to the front and, crucially, opens its agent buffer.
 * A detached chat already has one; an in-window chat needs the buffer opened
 * for the composer to accept a prompt.
 */
function revealExistingChat(chatId: string): string {
  useAIChatStore.getState().actions.switchToChat(chatId);

  if (openAgentWindowSession(chatId)) return chatId;

  useBufferStore.getState().actions.openAgentBuffer(chatId);

  const uiState = useUIState.getState();
  uiState.setActiveRightSidebarView("agents");
  uiState.setIsRightSidebarVisible(true);

  return chatId;
}
