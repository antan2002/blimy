import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface FrontendTerminalSession {
  windowLabel: string;
  frontendSessionId: string;
}

let frontendTerminalSession: FrontendTerminalSession | null = null;
let frontendTerminalSessionReady: Promise<void> | null = null;

export function getFrontendTerminalSessionArgs() {
  if (!frontendTerminalSession) {
    frontendTerminalSession = {
      windowLabel: getCurrentWebviewWindow().label,
      frontendSessionId: crypto.randomUUID(),
    };
  }

  return frontendTerminalSession;
}

export function initializeFrontendTerminalSession() {
  if (!frontendTerminalSessionReady) {
    const { windowLabel, frontendSessionId } = getFrontendTerminalSessionArgs();
    frontendTerminalSessionReady = invoke("begin_frontend_terminal_session", {
      windowLabel,
      sessionId: frontendSessionId,
    }).then(() => undefined);
  }

  return frontendTerminalSessionReady;
}

// The backend rejects terminals created before the session is registered, so
// terminal creation awaits this instead of the workbench blocking its first
// render on stale-connection cleanup.
export function ensureFrontendTerminalSession() {
  return initializeFrontendTerminalSession();
}
