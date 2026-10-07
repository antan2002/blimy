import { create } from "zustand";
import { createSelectors } from "@/utils/zustand-selectors";
import {
  EMPTY_EDITOR_VIEW_STATUS,
  type EditorViewStatus,
} from "@/features/layout/components/status-bar/editor-view-status";

/**
 * The status bar reads editor facts it cannot derive itself: line endings,
 * whether indentation inserts spaces, and the selection extent. The editor
 * surface reports them here because only it holds the live model.
 */

interface EditorViewStatusState {
  viewStatus: EditorViewStatus;
  actions: {
    reportViewStatus: (viewStatus: EditorViewStatus) => void;
    resetViewStatus: () => void;
  };
}

function isSameViewStatus(left: EditorViewStatus, right: EditorViewStatus): boolean {
  return (
    left.eol === right.eol &&
    left.insertSpaces === right.insertSpaces &&
    left.tabSize === right.tabSize &&
    left.line === right.line &&
    left.column === right.column &&
    left.lineCount === right.lineCount &&
    left.selectedCharacters === right.selectedCharacters &&
    left.selectedLines === right.selectedLines &&
    left.wordWrap === right.wordWrap &&
    left.lspActive === right.lspActive
  );
}

export const useEditorViewStatusStore = createSelectors(
  create<EditorViewStatusState>()((set) => ({
    viewStatus: EMPTY_EDITOR_VIEW_STATUS,
    actions: {
      reportViewStatus: (viewStatus) => {
        if (isSameViewStatus(useEditorViewStatusStore.getState().viewStatus, viewStatus)) {
          return;
        }
        set({ viewStatus });
      },
      resetViewStatus: () => set({ viewStatus: EMPTY_EDITOR_VIEW_STATUS }),
    },
  })),
);
