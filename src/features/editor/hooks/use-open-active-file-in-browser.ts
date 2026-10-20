import { useCallback } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { getBufferById, getBufferByPath } from "@/features/editor/utils/buffer-index";
import {
  isBrowserPreviewableFile,
  openPreviewInBrowser,
} from "@/features/editor/utils/open-preview-in-browser";

/** The file a preview buffer renders, or the buffer itself when it is a plain editor. */
function previewSourcePath(
  buffers: Parameters<typeof getBufferById>[0],
  activeBufferId: string | null,
): string | null {
  const active = getBufferById(buffers, activeBufferId);
  if (!active) return null;

  if ("sourceFilePath" in active && active.sourceFilePath) {
    return getBufferByPath(buffers, active.sourceFilePath)?.path ?? active.sourceFilePath;
  }

  return active.path;
}

/**
 * Opens the active HTML file in the system browser; used by the title bar's
 * preview button. `canPreviewInBrowser` tells the caller whether the active file
 * is something a browser can render, so the control can be disabled instead of
 * asking the OS to pick a program for a source file.
 */
export function useOpenActiveFileInBrowser() {
  const filePath = useBufferStore(
    useShallow((state) => previewSourcePath(state.buffers, state.activeBufferId)),
  );
  const canPreviewInBrowser = isBrowserPreviewableFile(filePath);

  const openActiveFileInBrowser = useCallback(async () => {
    const opened = await openPreviewInBrowser(filePath);
    if (!opened) {
      toast.error("Only HTML files can be previewed in the browser.");
    }
  }, [filePath]);

  return { openActiveFileInBrowser, canPreviewInBrowser };
}
