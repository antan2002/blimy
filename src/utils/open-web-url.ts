import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Opens a URL only when one is actually configured and absolute. The service URLs default to
 * empty now, so callers must not try to open an empty, relative, or scheme-less string as a
 * link; doing so would route inside the app or trip the external-navigation guard.
 */
export async function openWebUrl(url: string): Promise<void> {
  if (!isOpenableWebUrl(url)) return;
  await openUrl(url);
}

/**
 * Whether a URL is one the app opens externally. Only absolute http and https
 * addresses qualify, so local files and custom schemes never reach the OS.
 */
export function isOpenableWebUrl(url: string): boolean {
  if (!url.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}
