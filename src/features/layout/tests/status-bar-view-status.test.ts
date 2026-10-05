import { describe, expect, it } from "vite-plus/test";
import {
  EMPTY_EDITOR_VIEW_STATUS,
  formatIndentation,
  formatLanguageLabel,
  formatLineEnding,
  formatSelection,
  type EditorViewStatus,
} from "@/features/layout/components/status-bar/editor-view-status";

function status(overrides: Partial<EditorViewStatus> = {}): EditorViewStatus {
  return { ...EMPTY_EDITOR_VIEW_STATUS, ...overrides };
}

describe("status bar line endings", () => {
  it("labels a CRLF buffer as CRLF", () => {
    expect(formatLineEnding("\r\n")).toBe("CRLF");
  });

  it("labels an LF buffer as LF", () => {
    expect(formatLineEnding("\n")).toBe("LF");
  });

  it("reports nothing when the editor has not told us yet", () => {
    expect(formatLineEnding(undefined)).toBeUndefined();
  });
});

describe("status bar indentation", () => {
  it("reports the space width when indentation inserts spaces", () => {
    expect(formatIndentation(status({ insertSpaces: true, tabSize: 4 }))).toBe("Spaces: 4");
  });

  it("reports the width as a tab size when indentation inserts tabs", () => {
    expect(formatIndentation(status({ insertSpaces: false, tabSize: 4 }))).toBe("Tab Size: 4");
  });

  it("reports nothing rather than guessing a default", () => {
    expect(formatIndentation(status())).toBeUndefined();
    expect(formatIndentation(status({ insertSpaces: true }))).toBeUndefined();
  });
});

describe("status bar selection", () => {
  it("shows nothing for an empty selection", () => {
    expect(formatSelection(status())).toBe("");
  });

  it("counts one selected character in the singular", () => {
    expect(formatSelection(status({ selectedCharacters: 1, selectedLines: 1 }))).toBe(
      "(1 character selected)",
    );
  });

  it("counts multiple characters", () => {
    expect(formatSelection(status({ selectedCharacters: 12, selectedLines: 1 }))).toBe(
      "(12 characters selected)",
    );
  });

  it("counts the lines a selection touches, not the span", () => {
    // A selection from line 2 to line 4 touches three lines.
    expect(formatSelection(status({ selectedCharacters: 30, selectedLines: 3 }))).toBe(
      "(30 characters, 3 lines selected)",
    );
  });
});

describe("status bar language label", () => {
  it("capitalises a language id", () => {
    expect(formatLanguageLabel("typescript")).toBe("Typescript");
  });

  it("spells out plaintext", () => {
    expect(formatLanguageLabel("plaintext")).toBe("Plain Text");
  });

  it("falls back to Plain Text for an unknown language", () => {
    expect(formatLanguageLabel(undefined)).toBe("Plain Text");
  });
});
