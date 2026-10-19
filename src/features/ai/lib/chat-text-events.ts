import {
  appendAgentDraftText,
  hasAnyAgentDraftReader,
} from "@/features/ai/detached/agent-window-drafts";

export const AI_CHAT_INSERT_TEXT_EVENT = "blimy-ai-insert-text";

export interface AIChatInsertTextDetail {
  text: string;
  surfaceId?: string;
}

export function dispatchAIChatTextInsert(text: string, surfaceId?: string) {
  window.dispatchEvent(
    new CustomEvent<AIChatInsertTextDetail>(AI_CHAT_INSERT_TEXT_EVENT, {
      detail: { text, surfaceId },
    }),
  );
}

/**
 * Inserts text into the active AI chat composer, or stores it into the draft
 * if no composer is currently mounted.
 */
export function insertChatText(text: string, targetSurfaceId = "sidebar") {
  if (hasAnyAgentDraftReader()) {
    dispatchAIChatTextInsert(text, targetSurfaceId);
  } else {
    appendAgentDraftText(targetSurfaceId, text);
  }
}
