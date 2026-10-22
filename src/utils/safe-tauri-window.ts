import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow, type WebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * Returns the current Tauri Window instance if available, or null when running in a browser,
 * test environment, or before Tauri's IPC metadata is attached.
 */
export function safeGetCurrentWindow(): Window | null {
  if (typeof window === "undefined") return null;
  try {
    if (!isTauri()) return null;
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/**
 * Returns the current Tauri WebviewWindow instance if available, or null when running in a browser,
 * test environment, or before Tauri's IPC metadata is attached.
 */
export function safeGetCurrentWebviewWindow(): WebviewWindow | null {
  if (typeof window === "undefined") return null;
  try {
    if (!isTauri()) return null;
    return getCurrentWebviewWindow();
  } catch {
    return null;
  }
}
