import { toast } from "sonner";
import { useTerminalTabsStore } from "../stores/terminal-tabs.store";
import { useTerminalStore } from "../stores/terminal.store";
import { getTerminalInstance } from "./terminal-session-registry";
import { stripAnsi } from "../utils/strip-ansi";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { openAgentWindowSession } from "@/features/ai/detached/agent-window-service";
import { insertChatText } from "@/features/ai/lib/chat-text-events";
import { useUIState } from "@/features/window/stores/ui-state.store";
import { useBufferStore } from "@/features/editor/stores/buffer.store";

/**
 * Sends the selected terminal text or terminal buffer output to the active AI Chat session.
 * Reveals the AI chat panel and focuses the input.
 */
export async function sendTerminalToChat(terminalId?: string): Promise<boolean> {
  const tabsState = useTerminalTabsStore.getState();
  const bufferStore = useBufferStore.getState();

  let id = terminalId ?? tabsState.activeTerminalId;

  if (!id) {
    const activeBuffer = bufferStore.buffers.find((b) => b.id === bufferStore.activeBufferId);
    if (activeBuffer?.type === "terminal" && activeBuffer.sessionId) {
      id = activeBuffer.sessionId;
    }
  }

  if (!id && tabsState.terminals.length > 0) {
    id = tabsState.terminals[0]?.id;
  }

  if (!id) {
    toast.error("Select a terminal first");
    return false;
  }

  const tabTerminal = tabsState.terminals.find((item) => item.id === id);
  const bufferTerminal = bufferStore.buffers.find(
    (b) => b.type === "terminal" && b.sessionId === id,
  );
  const session = useTerminalStore.getState().actions.getSession(id);
  const instance = getTerminalInstance(id);

  if (!tabTerminal && !bufferTerminal && !session && !instance) {
    toast.error("Select a terminal first");
    return false;
  }

  const terminalName =
    tabTerminal?.name || bufferTerminal?.name || session?.name || session?.title || "Terminal";

  const bufferDirectory =
    bufferTerminal && bufferTerminal.type === "terminal" ? bufferTerminal.workingDirectory : "";

  const terminalDirectory =
    tabTerminal?.currentDirectory || bufferDirectory || session?.currentDirectory || "";

  const sessionRef = session?.ref?.current;

  // Prioritize selected text first
  const selectedText = instance?.getSelection?.()?.trim() || sessionRef?.getSelection?.()?.trim();

  // If no selection, get the full buffer text
  let rawText = selectedText;
  if (!rawText) {
    const bufferText = instance?.getBufferText?.()?.trim();
    if (bufferText) {
      rawText = bufferText;
    } else {
      const serialized = instance?.serialize?.()?.trim() || sessionRef?.serialize?.()?.trim();
      if (serialized) {
        rawText = serialized;
      }
    }
  }

  const cleanText = rawText ? stripAnsi(rawText).trim() : "";

  // Always produce a usable snippet so the user is never blocked
  let terminalSnippet: string;
  if (cleanText) {
    const content = !selectedText && cleanText.length > 30000 ? cleanText.slice(-30000) : cleanText;
    terminalSnippet = `Terminal output (${terminalName}):\n\`\`\`bash\n${content}\n\`\`\``;
  } else {
    terminalSnippet = `Terminal (${terminalName}):\n\`\`\`bash\n# Terminal is open with no output yet${terminalDirectory ? `\n# Directory: ${terminalDirectory}` : ""}\n\`\`\``;
  }

  const chatStore = useAIChatStore.getState();
  let chatId = chatStore.currentChatId;
  const currentChat = chatId ? chatStore.chats.find((c) => c.id === chatId) : undefined;
  if (!chatId || !currentChat || currentChat.archivedAt) {
    chatId = chatStore.actions.createNewChat(chatStore.actions.getCurrentAgentId(), {
      activate: true,
    });
  }

  const uiState = useUIState.getState();
  if (!openAgentWindowSession(chatId)) {
    uiState.setActiveRightSidebarView("agents");
    uiState.setIsRightSidebarVisible(true);
  }

  insertChatText(terminalSnippet);

  toast.success("Terminal output sent to chat");
  return true;
}
