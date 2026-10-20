import { open } from "@tauri-apps/plugin-shell";
import { normalizePath } from "@/utils/path-helpers";

const BROWSER_PREVIEW_EXTENSIONS = new Set(["html", "htm"]);

/**
 * Browsers render HTML documents, so only `.html`/`.htm` files have a preview
 * worth opening externally. Any other file type would hand the OS a `file://`
 * URL it cannot map to a program.
 */
export function isBrowserPreviewableFile(path: string | null | undefined): boolean {
  if (!path) return false;
  const extension = path.split(".").pop()?.toLowerCase();
  return extension !== undefined && BROWSER_PREVIEW_EXTENSIONS.has(extension);
}

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
 * Opens one HTML file from disk in the system browser through its `file://` URL.
 * Returns false when the path is missing, is not an HTML file, or has no browser
 * address.
 */
export async function openPreviewInBrowser(path: string | null | undefined): Promise<boolean> {
  if (!isBrowserPreviewableFile(path)) return false;

  const url = toFileUrl(path);
  if (!url) return false;

  await open(url);
  return true;
}
