/**
 * Status bar facts about the active text editor.
 *
 * Everything here is reported by the editor surface itself rather than guessed
 * from settings, so the bar cannot drift from what the buffer actually does.
 * `undefined` means the editor has not reported yet, which the bar renders as
 * unavailable instead of a made-up value.
 */
export interface EditorViewStatus {
  /** Model line ending, as reported by the editor. */
  eol: "\n" | "\r\n" | undefined;
  /** Whether indentation inserts spaces rather than tabs. */
  insertSpaces: boolean | undefined;
  /** Effective indentation width, which can differ from the setting. */
  tabSize: number | undefined;
  /** 1-based cursor line. */
  line: number;
  /** 1-based cursor column. */
  column: number;
  /** Total lines in the buffer. */
  lineCount: number;
  /** Characters currently selected, 0 when the selection is empty. */
  selectedCharacters: number;
  /** Lines touched by the selection, 0 when the selection is empty. */
  selectedLines: number;
  /** True when the buffer wraps instead of scrolling horizontally. */
  wordWrap: boolean;
  /** True when more than one language server is attached to this buffer. */
  lspActive: boolean;
}

export const EMPTY_EDITOR_VIEW_STATUS: EditorViewStatus = {
  eol: undefined,
  insertSpaces: undefined,
  tabSize: undefined,
  line: 1,
  column: 1,
  lineCount: 1,
  selectedCharacters: 0,
  selectedLines: 0,
  wordWrap: false,
  lspActive: false,
};

export type LineEndingLabel = "LF" | "CRLF";

export function formatLineEnding(eol: EditorViewStatus["eol"]): LineEndingLabel | undefined {
  if (eol === "\r\n") return "CRLF";
  if (eol === "\n") return "LF";
  return undefined;
}

export function formatIndentation(status: EditorViewStatus): string | undefined {
  if (status.insertSpaces === undefined || status.tabSize === undefined) return undefined;
  return status.insertSpaces ? `Spaces: ${status.tabSize}` : `Tab Size: ${status.tabSize}`;
}

/**
 * The selection suffix VS Code shows next to the cursor. An empty selection
 * reports nothing, and a multi-line selection counts the lines it touches
 * rather than the lines it spans, so `1 -> 4` on three lines reads as 3.
 */
export function formatSelection(status: EditorViewStatus): string {
  if (status.selectedCharacters === 0) return "";

  const characters = status.selectedCharacters === 1 ? "character" : "characters";
  if (status.selectedLines <= 1) {
    return `(${status.selectedCharacters} ${characters} selected)`;
  }

  const lines = status.selectedLines === 1 ? "line" : "lines";
  return `(${status.selectedCharacters} ${characters}, ${status.selectedLines} ${lines} selected)`;
}

export function formatLanguageLabel(language: string | undefined): string {
  if (!language) return "Plain Text";
  if (language === "plaintext") return "Plain Text";
  return language.charAt(0).toUpperCase() + language.slice(1);
}
