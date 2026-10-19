import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  terminal: {
    id: "term-1",
    name: "Terminal 1",
    currentDirectory: "/test/dir",
  },
  session: {
    ref: {
      current: {
        getSelection: vi.fn(),
        serialize: vi.fn(),
      },
    },
  },
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createNewChat: vi.fn(() => "chat-123"),
  getCurrentAgentId: vi.fn(() => "custom"),
  openAgentWindowSession: vi.fn(() => false),
  setIsRightSidebarVisible: vi.fn(),
  setActiveRightSidebarView: vi.fn(),
  insertChatText: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: mocks.toastInfo,
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("../stores/terminal-tabs.store", () => ({
  useTerminalTabsStore: {
    getState: () => ({
      terminals: [mocks.terminal],
      activeTerminalId: "term-1",
    }),
  },
}));

vi.mock("../stores/terminal.store", () => ({
  useTerminalStore: {
    getState: () => ({
      actions: {
        getSession: (id: string) => (id === "term-1" ? mocks.session : undefined),
      },
    }),
  },
}));

vi.mock("@/features/ai/stores/ai-chat.store", () => ({
  useAIChatStore: {
    getState: () => ({
      currentChatId: "chat-existing",
      chats: [{ id: "chat-existing", agentId: "custom" }],
      actions: {
        createNewChat: mocks.createNewChat,
        getCurrentAgentId: mocks.getCurrentAgentId,
      },
    }),
  },
}));

vi.mock("@/features/ai/detached/agent-window-service", () => ({
  openAgentWindowSession: mocks.openAgentWindowSession,
}));

vi.mock("@/features/window/stores/ui-state.store", () => ({
  useUIState: {
    getState: () => ({
      setIsRightSidebarVisible: mocks.setIsRightSidebarVisible,
      setActiveRightSidebarView: mocks.setActiveRightSidebarView,
    }),
  },
}));

vi.mock("@/features/ai/lib/chat-text-events", () => ({
  insertChatText: mocks.insertChatText,
}));

import { sendTerminalToChat } from "../services/send-terminal-to-chat";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.ref.current.getSelection.mockReturnValue("");
  mocks.session.ref.current.serialize.mockReturnValue("");
});

describe("sendTerminalToChat", () => {
  it("sends empty terminal information gracefully when terminal has no output yet", async () => {
    const success = await sendTerminalToChat("term-1");
    expect(success).toBe(true);
    expect(mocks.insertChatText).toHaveBeenCalledWith(
      "Terminal (Terminal 1):\n```bash\n# Terminal is open with no output yet\n# Directory: /test/dir\n```",
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Terminal output sent to chat");
  });

  it("sends selected text when text is highlighted in terminal", async () => {
    mocks.session.ref.current.getSelection.mockReturnValue("npm run test:fail\nError 404");
    mocks.session.ref.current.serialize.mockReturnValue(
      "Full buffer content that shouldn't be used",
    );

    const success = await sendTerminalToChat("term-1");
    expect(success).toBe(true);
    expect(mocks.insertChatText).toHaveBeenCalledWith(
      "Terminal output (Terminal 1):\n```bash\nnpm run test:fail\nError 404\n```",
    );
    expect(mocks.setActiveRightSidebarView).toHaveBeenCalledWith("agents");
    expect(mocks.setIsRightSidebarVisible).toHaveBeenCalledWith(true);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Terminal output sent to chat");
  });

  it("falls back to serialized output and strips ANSI escapes when nothing is selected", async () => {
    mocks.session.ref.current.getSelection.mockReturnValue("");
    mocks.session.ref.current.serialize.mockReturnValue("\u001b[32m✔ Built in 12ms\u001b[0m");

    const success = await sendTerminalToChat("term-1");
    expect(success).toBe(true);
    expect(mocks.insertChatText).toHaveBeenCalledWith(
      "Terminal output (Terminal 1):\n```bash\n✔ Built in 12ms\n```",
    );
  });

  it("warns when no terminal exists", async () => {
    const success = await sendTerminalToChat("non-existent-terminal");
    expect(success).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("Select a terminal first");
  });
});
