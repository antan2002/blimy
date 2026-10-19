import type {
  AiIgnoreMatcher,
  AiIgnorePattern,
  AiIgnoreReader,
  LoadedAiIgnore,
} from "@/features/ai/types/ai-ignore.types";
import { AI_IGNORE_FILE_NAMES } from "@/features/ai/types/ai-ignore.types";
import { joinPath, normalizePath } from "@/utils/path-helpers";

function escapeLiteral(char: string) {
  return char.replace(/[.+^$()|[\]\\{}]/g, "\\$&");
}

/** `**` spans directories; `*` and `?` stay inside one path segment. */
function globBody(pattern: string): string {
  let source = "";
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        const followedBySlash = pattern[index + 2] === "/";
        source += followedBySlash ? "(?:.*/)?" : ".*";
        index += followedBySlash ? 2 : 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += escapeLiteral(char);
  }
  return source;
}

/**
 * Parses one ignore line. Comments (`#`), blanks and a lone `/` return null. Leading `#` and
 * `!` can be escaped with a backslash to keep them literal.
 */
export function compileAiIgnorePattern(rawLine: string): AiIgnorePattern | null {
  let line = rawLine.replace(/\r$/, "").replace(/(?<!\\)\s+$/, "");
  if (!line) return null;
  if (line.startsWith("\\#") || line.startsWith("\\!")) line = line.slice(1);
  else if (line.startsWith("#")) return null;

  let negated = false;
  if (line.startsWith("!")) {
    negated = true;
    line = line.slice(1);
  }
  if (!line || line === "/") return null;

  const directoryOnly = line.endsWith("/");
  if (directoryOnly) line = line.replace(/\/+$/, "");
  const leadingSlash = line.startsWith("/");
  if (leadingSlash) line = line.replace(/^\/+/, "");
  if (!line) return null;

  const anchored = leadingSlash || line.includes("/");
  const body = globBody(line);
  // A matched directory also excludes everything beneath it.
  const prefix = anchored ? "^" : "^(?:.*/)?";
  return {
    source: line,
    regexSource: `${prefix}${body}(?:/.*)?$`,
    negated,
    directoryOnly,
    anchored,
  };
}

/** Parses a whole ignore file, keeping the order of the usable lines. */
export function parseAiIgnorePatterns(content: string): AiIgnorePattern[] {
  const patterns: AiIgnorePattern[] = [];
  for (const line of content.split(/\r?\n/)) {
    const pattern = compileAiIgnorePattern(line);
    if (pattern) patterns.push(pattern);
  }
  return patterns;
}

/**
 * Compiles patterns into a matcher over project-relative paths. The last matching pattern
 * wins, so a later `!pattern` re-includes a path an earlier line excluded.
 *
 * A trailing `/` marks a directory but is otherwise treated like the same name without it:
 * a deliberately simple rule that matches editors' common expectations instead of the full
 * gitignore corner cases.
 */
export function createAiIgnoreMatcher(patterns: AiIgnorePattern[]): AiIgnoreMatcher {
  const compiled = patterns.map((pattern) => ({
    negated: pattern.negated,
    regex: new RegExp(pattern.regexSource),
  }));
  return (relativePath: string) => {
    if (compiled.length === 0) return false;
    const target = normalizePath(relativePath)
      .replace(/^\.?\//, "")
      .replace(/[/\\]+$/, "");
    if (!target) return false;
    let ignored = false;
    for (const { negated, regex } of compiled) {
      if (regex.test(target)) ignored = !negated;
    }
    return ignored;
  };
}

/** A matcher for the given ignore file contents, in the order the files were read. */
export function createAiIgnoreMatcherFromContents(contents: string[]): AiIgnoreMatcher {
  return createAiIgnoreMatcher(contents.flatMap(parseAiIgnorePatterns));
}

async function getDefaultReader(projectRoot: string): Promise<AiIgnoreReader> {
  const { getWorkspaceResourceProvider } =
    await import("@/features/file-system/services/workspace-resource-provider");
  const provider = getWorkspaceResourceProvider(projectRoot);
  return {
    readDirectory: (path) => provider.readDirectory(path, projectRoot),
    readText: (path) => provider.readText(path),
  };
}

/**
 * Reads `.cursorignore` and `.blimyignore` from the project root and compiles them. Reading
 * never blocks a request: unreadable files are skipped and an empty matcher is returned when
 * nothing was found.
 */
export async function loadAiIgnore(
  projectRoot: string,
  reader?: AiIgnoreReader,
): Promise<LoadedAiIgnore> {
  const io = reader ?? (await getDefaultReader(projectRoot));
  let rootNames: Set<string>;
  try {
    rootNames = new Set(
      (await io.readDirectory(projectRoot)).filter((item) => !item.isDir).map((item) => item.name),
    );
  } catch {
    return { matcher: () => false, patterns: [], files: [] };
  }

  const files: string[] = [];
  const patterns: AiIgnorePattern[] = [];
  for (const name of AI_IGNORE_FILE_NAMES) {
    if (!rootNames.has(name)) continue;
    try {
      const content = await io.readText(joinPath(projectRoot, name));
      patterns.push(...parseAiIgnorePatterns(content));
      files.push(name);
    } catch {
      // Skip an ignore file that cannot be read.
    }
  }
  return {
    matcher: createAiIgnoreMatcher(patterns),
    patterns,
    files,
  };
}
