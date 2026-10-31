import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  currentChatId: "chat-1" as string | null,
  chats: [] as { id: string; agentId: string; archivedAt?: string | null }[],
  setPendingAgentLaunchRequest: vi.fn(),
  getCurrentAgentId: vi.fn(() => "custom"),
  switchToChat: vi.fn(),
  openNewAgentChat: vi.fn(() => "chat-new"),
  openAgentWindowSession: vi.fn((): string | null => null),
  openAgentBuffer: vi.fn(() => "agent://chat-1"),
  setActiveRightSidebarView: vi.fn(),
  setIsRightSidebarVisible: vi.fn(),
}));

vi.mock("@/features/ai/stores/ai-chat.store", () => ({
  useAIChatStore: {
    getState: () => ({
      currentChatId: mocks.currentChatId,
      chats: mocks.chats,
      actions: {
        setPendingAgentLaunchRequest: mocks.setPendingAgentLaunchRequest,
        getCurrentAgentId: mocks.getCurrentAgentId,
        switchToChat: mocks.switchToChat,
      },
    }),
  },
}));

vi.mock("@/features/ai/lib/open-new-agent-chat", () => ({
  openNewAgentChat: mocks.openNewAgentChat,
}));

vi.mock("@/features/ai/detached/agent-window-service", () => ({
  openAgentWindowSession: mocks.openAgentWindowSession,
}));

vi.mock("@/features/editor/stores/buffer.store", () => ({
  useBufferStore: {
    getState: () => ({ actions: { openAgentBuffer: mocks.openAgentBuffer } }),
  },
}));

vi.mock("@/features/window/stores/ui-state.store", () => ({
  useUIState: {
    getState: () => ({
      setActiveRightSidebarView: mocks.setActiveRightSidebarView,
      setIsRightSidebarVisible: mocks.setIsRightSidebarVisible,
    }),
  },
}));

import { sendReviewToAgentChat } from "@/features/ai/pr-review/send-review-to-agent-chat";

describe("sendReviewToAgentChat", () => {
  beforeEach(() => {
    mocks.currentChatId = "chat-1";
    mocks.chats = [{ id: "chat-1", agentId: "custom", archivedAt: null }];
    mocks.setPendingAgentLaunchRequest.mockReset();
    mocks.openNewAgentChat.mockClear();
    mocks.switchToChat.mockClear();
    mocks.openAgentBuffer.mockClear();
    mocks.openAgentWindowSession.mockReset();
    mocks.openAgentWindowSession.mockReturnValue(null);
  });

  it("sends the review as a prompt, not as appended context", () => {
    sendReviewToAgentChat("## PR review\n\nA finding.");

    const request = mocks.setPendingAgentLaunchRequest.mock.calls[0][0];

    expect(request.prompt).toBe("## PR review\n\nA finding.");
    // `mode: "append"` only merges context and returns before the prompt is read,
    // so the review would be dropped. The mode must stay unset.
    expect(request.mode).toBeUndefined();
  });

  it("opens the agent buffer so the composer accepts the prompt", () => {
    // The send effect bails out unless the chat's agent buffer is the active
    // buffer. Showing the sidebar is not enough, so this is the load-bearing call.
    sendReviewToAgentChat("## PR review");

    expect(mocks.openAgentBuffer).toHaveBeenCalledWith("chat-1");
    expect(mocks.setActiveRightSidebarView).toHaveBeenCalledWith("agents");
    expect(mocks.setIsRightSidebarVisible).toHaveBeenCalledWith(true);
  });

  it("reuses the open chat instead of creating another one", () => {
    const chatId = sendReviewToAgentChat("## PR review");

    expect(chatId).toBe("chat-1");
    expect(mocks.switchToChat).toHaveBeenCalledWith("chat-1");
    expect(mocks.openNewAgentChat).not.toHaveBeenCalled();
  });

  it("lets a detached chat keep its own buffer", () => {
    mocks.openAgentWindowSession.mockReturnValue("chat-1");

    sendReviewToAgentChat("## PR review");

    expect(mocks.openAgentBuffer).not.toHaveBeenCalled();
  });

  it("falls back to the new-chat helper when the current one is archived", () => {
    mocks.chats = [{ id: "chat-1", agentId: "custom", archivedAt: "2026-01-01" }];

    const chatId = sendReviewToAgentChat("## PR review");

    // openNewAgentChat owns buffer activation, so it must not be duplicated.
    expect(mocks.openNewAgentChat).toHaveBeenCalled();
    expect(mocks.openAgentBuffer).not.toHaveBeenCalled();
    expect(chatId).toBe("chat-new");
  });

  it("targets the chat the new-chat helper created", () => {
    mocks.currentChatId = null;
    mocks.chats = [];

    sendReviewToAgentChat("## PR review");

    expect(mocks.setPendingAgentLaunchRequest.mock.calls[0][0].chatId).toBe("chat-new");
  });

  it("ignores an empty review", () => {
    expect(sendReviewToAgentChat("   ")).toBeNull();
    expect(mocks.setPendingAgentLaunchRequest).not.toHaveBeenCalled();
  });
});
