/** A parsed AI-ignore rule, in the order it appeared in the file. */
export interface AiIgnorePattern {
  /** The original line, trimmed, with the leading `!` and trailing `/` removed. */
  source: string;
  /** The regular expression source the pattern compiles to, anchored at both ends. */
  regexSource: string;
  /** True when the rule re-includes (`!pattern`) a previously ignored path. */
  negated: boolean;
  /** True when the rule only matches directories (the line ended with `/`). */
  directoryOnly: boolean;
  /**
   * True when the rule is anchored to the project root: either the pattern had a leading
   * `/` or it contains a `/` somewhere other than the end.
   */
  anchored: boolean;
}

/** Files read from the project root, in priority order. Later files extend earlier ones. */
export const AI_IGNORE_FILE_NAMES = [".cursorignore", ".blimyignore"] as const;

export type AiIgnoreFileName = (typeof AI_IGNORE_FILE_NAMES)[number];

/** Decides whether a project-relative path is excluded from AI context. */
export type AiIgnoreMatcher = (relativePath: string, isDir?: boolean) => boolean;

/** How ignore files are read; the default uses the workspace resource provider. */
export interface AiIgnoreReader {
  readDirectory(path: string): Promise<{ name: string; path: string; isDir: boolean }[]>;
  readText(path: string): Promise<string>;
}

export interface LoadedAiIgnore {
  /** The compiled matcher; never excludes anything when no ignore file exists. */
  matcher: AiIgnoreMatcher;
  patterns: AiIgnorePattern[];
  /** Project-relative paths of the ignore files that were read. */
  files: string[];
}
