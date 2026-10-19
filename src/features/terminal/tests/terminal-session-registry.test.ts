import { describe, expect, it, vi } from "vite-plus/test";
import {
  extractTerminalBufferLines,
  getTerminalInstance,
  registerTerminalInstance,
  type TerminalInstanceHandle,
} from "../services/terminal-session-registry";
import type { Terminal as XtermTerminal } from "@xterm/xterm";

describe("terminal-session-registry", () => {
  it("registers and retrieves terminal instance handles", () => {
    const handle: TerminalInstanceHandle = {
      terminal: null,
      getSelection: () => "selected text",
      getBufferText: () => "buffer line 1\nbuffer line 2",
      serialize: () => "serialized output",
      clear: vi.fn(),
    };

    const unregister = registerTerminalInstance("test-session-1", handle);
    expect(getTerminalInstance("test-session-1")).toBe(handle);

    unregister();
    expect(getTerminalInstance("test-session-1")).toBeUndefined();
  });

  it("extracts trimmed active buffer lines from xterm terminal", () => {
    const mockLines = [
      { translateToString: () => "first line" },
      { translateToString: () => "second line" },
      { translateToString: () => "   " },
      { translateToString: () => "" },
    ];

    const mockTerminal = {
      buffer: {
        active: {
          length: mockLines.length,
          getLine: (index: number) => mockLines[index],
        },
      },
    } as unknown as XtermTerminal;

    const extracted = extractTerminalBufferLines(mockTerminal);
    expect(extracted).toEqual(["first line", "second line"]);
  });
});
