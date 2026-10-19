import { useCallback } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { getBufferById, getBufferByPath } from "@/features/editor/utils/buffer-index";
import { openPreviewInBrowser } from "@/features/editor/utils/open-preview-in-browser";

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

/** Opens the active file in the system browser; used by the title bar's preview button. */
export function useOpenActiveFileInBrowser() {
  const filePath = useBufferStore(
    useShallow((state) => previewSourcePath(state.buffers, state.activeBufferId)),
  );

  return useCallback(async () => {
    const opened = await openPreviewInBrowser(filePath);
    if (!opened) toast.error("There is no file to preview in the browser.");
  }, [filePath]);
}
