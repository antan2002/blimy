import { invoke, isTauri } from "@tauri-apps/api/core";
import { safeGetCurrentWebviewWindow } from "@/utils/safe-tauri-window";

interface FrontendTerminalSession {
  windowLabel: string;
  frontendSessionId: string;
}

let frontendTerminalSession: FrontendTerminalSession | null = null;
let frontendTerminalSessionReady: Promise<void> | null = null;

export function getFrontendTerminalSessionArgs() {
  if (!frontendTerminalSession) {
    frontendTerminalSession = {
      windowLabel: safeGetCurrentWebviewWindow()?.label ?? "main",
      frontendSessionId: crypto.randomUUID(),
    };
  }

  return frontendTerminalSession;
}

export function initializeFrontendTerminalSession() {
  if (!frontendTerminalSessionReady) {
    if (!isTauri()) {
      frontendTerminalSessionReady = Promise.resolve();
      return frontendTerminalSessionReady;
    }
    const { windowLabel, frontendSessionId } = getFrontendTerminalSessionArgs();
    frontendTerminalSessionReady = invoke("begin_frontend_terminal_session", {
      windowLabel,
      sessionId: frontendSessionId,
    })
      .then(() => undefined)
      .catch((error) => {
        console.warn("Failed to begin frontend terminal session:", error);
      });
  }

  return frontendTerminalSessionReady;
}

// The backend rejects terminals created before the session is registered, so
// terminal creation awaits this instead of the workbench blocking its first
// render on stale-connection cleanup.
export function ensureFrontendTerminalSession() {
  return initializeFrontendTerminalSession();
}
