import { open } from "@tauri-apps/plugin-shell";
import { normalizePath } from "@/utils/path-helpers";

/**
 * A `file://` URL for a local path. Remote and WSL paths have no browser address,
 * so they return null.
 */
export function toFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("remote://") || path.startsWith("wsl://")) return null;

  const normalized = normalizePath(path);
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${encodeURI(withLeadingSlash)}`;
}

/**
 * Opens one file from disk in the system browser through its `file://` URL.
 * Returns false when the path is missing or has no browser address.
 */
export async function openPreviewInBrowser(path: string | null | undefined): Promise<boolean> {
  const url = toFileUrl(path);
  if (!url) return false;

  await open(url);
  return true;
}
