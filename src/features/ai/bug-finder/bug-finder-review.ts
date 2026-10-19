import type { Diagnostic } from "@/features/diagnostics/types/diagnostics.types";

export const BUG_FINDER_OWNER = "bug-finder";
export const BUG_FINDER_SOURCE = "bug-finder";
export const MAX_BUG_FINDINGS = 20;
export const MAX_BUG_DIFF_CHARS = 40_000;

export interface BugFinding {
  line: number;
  endLine: number;
  severity: Diagnostic["severity"];
  message: string;
}

export const BUG_FINDER_SYSTEM_PROMPT = [
  "You review a unified diff for real bugs only: logic errors, crashes, resource leaks,",
  "race conditions, off-by-one mistakes, unhandled errors, and security flaws.",
  "Ignore style, formatting, naming, and missing tests.",
  "Output ONLY a JSON array, with no prose and no code fences.",
  "Each item must be an object with these keys:",
  '{"line": <number>, "endLine": <number>, "severity": "error" | "warning" | "info", "message": "<one sentence, the fix>"}',
  "Line numbers are 1-based and refer to the new version of the file.",
  "Report at most one finding per distinct problem. If there are no bugs, output [].",
].join(" ");

const SEVERITY_BY_NAME: Record<string, BugFinding["severity"]> = {
  error: "error",
  bug: "error",
  critical: "error",
  high: "error",
  warning: "warning",
  warn: "warning",
  medium: "warning",
  info: "info",
  hint: "info",
  nit: "info",
  low: "info",
  suggestion: "info",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractJsonArray(text: string): unknown[] | null {
  const withoutFences = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  if (withoutFences === "") {
    return null;
  }

  const candidates = [withoutFences];
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");

  if (start >= 0 && end > start) {
    candidates.push(withoutFences.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;

      for (const key of ["bugs", "findings", "results"]) {
        if (Array.isArray(record[key])) {
          return record[key] as unknown[];
        }
      }
    }
  }

  return null;
}

function toFinding(value: unknown, lineCount: number): BugFinding | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const rawLine = readNumeric(item.line);

  if (rawLine === null) {
    return null;
  }

  const message = typeof item.message === "string" ? item.message.trim() : "";

  if (message === "") {
    return null;
  }

  const line = clamp(Math.round(rawLine), 1, lineCount);
  const rawEndLine = readNumeric(item.endLine);
  const endLine = rawEndLine === null ? line : clamp(Math.round(rawEndLine), line, lineCount);
  const severityName = typeof item.severity === "string" ? item.severity.trim().toLowerCase() : "";

  return {
    line,
    endLine,
    severity: SEVERITY_BY_NAME[severityName] ?? "warning",
    message: message.slice(0, 500),
  };
}

/**
 * Parse the model reply into findings. The reply is expected to be a JSON array
 * of `{ line, endLine, severity, message }` objects with 1-based line numbers.
 * Anything malformed is dropped instead of surfaced as a fake finding.
 */
export function parseBugFinderFindings(text: string, lineCount: number): BugFinding[] {
  if (!Number.isFinite(lineCount) || lineCount < 1) {
    return [];
  }

  const raw = extractJsonArray(text);

  if (!raw) {
    return [];
  }

  const findings: BugFinding[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const finding = toFinding(value, lineCount);

    if (!finding) {
      continue;
    }

    const key = `${finding.line}:${finding.message}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    findings.push(finding);

    if (findings.length >= MAX_BUG_FINDINGS) {
      break;
    }
  }

  return findings;
}

export function buildBugFinderPrompt(input: { filePath: string; diff: string }): string {
  const diff =
    input.diff.length > MAX_BUG_DIFF_CHARS
      ? `${input.diff.slice(0, MAX_BUG_DIFF_CHARS)}\n... (diff truncated)`
      : input.diff;

  return [`File: ${input.filePath}`, "", "Unified diff:", "```diff", diff, "```"].join("\n");
}

/**
 * Map findings onto the diagnostics model, which is 0-based because it mirrors
 * LSP ranges.
 */
export function toBugDiagnostics(filePath: string, findings: BugFinding[]): Diagnostic[] {
  return findings.map((finding) => ({
    severity: finding.severity,
    filePath,
    line: Math.max(0, finding.line - 1),
    column: 0,
    endLine: Math.max(0, finding.endLine - 1),
    endColumn: 0,
    message: finding.message,
    source: BUG_FINDER_SOURCE,
    owner: BUG_FINDER_OWNER,
  }));
}
