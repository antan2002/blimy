import type { Diagnostic } from "@/features/diagnostics/types/diagnostics.types";
import type { GitDiff } from "@/features/git/types/git.types";

import {
  BUG_FINDER_OWNER,
  BUG_FINDER_SYSTEM_PROMPT,
  type BugFinding,
  buildBugFinderPrompt,
  parseBugFinderFindings,
  toBugDiagnostics,
} from "./bug-finder-review";

const REVIEWABLE_EXTENSIONS = new Set([
  "bash",
  "c",
  "cc",
  "cpp",
  "cs",
  "cjs",
  "cxx",
  "go",
  "h",
  "hpp",
  "java",
  "js",
  "jsx",
  "kt",
  "kts",
  "mjs",
  "mts",
  "php",
  "py",
  "rb",
  "rs",
  "scala",
  "sh",
  "sql",
  "svelte",
  "swift",
  "ts",
  "tsx",
  "vue",
  "zsh",
]);

export interface BugFinderModelRequest {
  systemPrompt: string;
  prompt: string;
}

export interface BugFinderDependencies {
  /** Runs a single headless model turn. Never routed through the chat store. */
  callModel: (request: BugFinderModelRequest) => Promise<string>;
  getFileDiff: (filePath: string, content: string) => Promise<GitDiff | null>;
  setDiagnostics: (filePath: string, diagnostics: Diagnostic[], owner: string) => void;
  isEnabled: () => boolean;
  isIgnored?: (filePath: string) => boolean;
  onError?: (error: unknown) => void;
}

export interface BugFinderService {
  reviewFile: (input: { filePath: string; content: string }) => Promise<BugFinding[]>;
  clear: (filePath: string) => void;
  isReviewing: (filePath: string) => boolean;
}

export function isReviewableFile(filePath: string): boolean {
  const name = filePath.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");

  if (dot <= 0) {
    return false;
  }

  return REVIEWABLE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export function countLines(content: string): number {
  if (content === "") {
    return 0;
  }

  return content.split("\n").length;
}

/**
 * Rebuild a unified diff from the parsed shape when the backend did not send a
 * raw patch, so a review still has something to read.
 */
export function formatGitDiffForReview(diff: GitDiff): string {
  if (diff.raw_patch && diff.raw_patch.trim() !== "") {
    return diff.raw_patch;
  }

  return diff.lines
    .map((line) => {
      switch (line.line_type) {
        case "added":
          return `+${line.content}`;
        case "removed":
          return `-${line.content}`;
        default:
          return ` ${line.content}`;
      }
    })
    .join("\n");
}

export function createBugFinderService(dependencies: BugFinderDependencies): BugFinderService {
  const inFlight = new Set<string>();

  const clear = (filePath: string) => {
    dependencies.setDiagnostics(filePath, [], BUG_FINDER_OWNER);
  };

  const reviewFile: BugFinderService["reviewFile"] = async ({ filePath, content }) => {
    if (!dependencies.isEnabled() || !isReviewableFile(filePath)) {
      return [];
    }

    if (dependencies.isIgnored?.(filePath)) {
      clear(filePath);
      return [];
    }

    const lineCount = countLines(content);

    if (lineCount === 0 || inFlight.has(filePath)) {
      return [];
    }

    inFlight.add(filePath);

    try {
      const diff = await dependencies.getFileDiff(filePath, content);

      if (!diff || diff.is_binary || diff.is_deleted) {
        clear(filePath);
        return [];
      }

      const patch = formatGitDiffForReview(diff);

      if (patch.trim() === "") {
        clear(filePath);
        return [];
      }

      const reply = await dependencies.callModel({
        systemPrompt: BUG_FINDER_SYSTEM_PROMPT,
        prompt: buildBugFinderPrompt({ filePath, diff: patch }),
      });
      const findings = parseBugFinderFindings(reply, lineCount);

      dependencies.setDiagnostics(filePath, toBugDiagnostics(filePath, findings), BUG_FINDER_OWNER);

      return findings;
    } catch (error) {
      dependencies.onError?.(error);
      clear(filePath);
      return [];
    } finally {
      inFlight.delete(filePath);
    }
  };

  return {
    reviewFile,
    clear,
    isReviewing: (filePath) => inFlight.has(filePath),
  };
}
