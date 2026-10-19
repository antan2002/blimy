import type { Terminal as XtermTerminal } from "@xterm/xterm";

export interface TerminalInstanceHandle {
  terminal: XtermTerminal | null;
  getSelection: () => string;
  getBufferText: () => string;
  serialize: () => string;
  clear: () => void;
  selectAll?: () => void;
  clearSelection?: () => void;
  focus?: () => void;
  blur?: () => void;
  showSearch?: () => void;
  scrollToTop?: () => void;
  scrollToBottom?: () => void;
  resize?: () => void;
}

const instances = new Map<string, TerminalInstanceHandle>();

/**
 * Registers an active terminal frontend instance handle so services
 * and controls can reliably interact with the terminal buffer.
 */
export function registerTerminalInstance(
  sessionId: string,
  handle: TerminalInstanceHandle,
): () => void {
  instances.set(sessionId, handle);
  return () => {
    if (instances.get(sessionId) === handle) {
      instances.delete(sessionId);
    }
  };
}

/**
 * Retrieves an active terminal frontend instance handle by session ID.
 */
export function getTerminalInstance(sessionId: string): TerminalInstanceHandle | undefined {
  return instances.get(sessionId);
}

/**
 * Extracts visible and scrollback buffer lines directly from the xterm instance.
 */
export function extractTerminalBufferLines(terminal: XtermTerminal): string[] {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    lines.push(line.translateToString(true));
  }
  // Trim trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines;
}
