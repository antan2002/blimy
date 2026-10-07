import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Opens a URL only when one is actually configured and absolute. The service URLs default to
 * empty now, so callers must not try to open an empty, relative, or scheme-less string as a
 * link; doing so would route inside the app or trip the external-navigation guard.
 */
export async function openWebUrl(url: string): Promise<void> {
  if (!url.trim()) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
  await openUrl(url);
}
