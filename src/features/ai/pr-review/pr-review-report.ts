export const MAX_PR_REVIEW_FINDINGS = 40;
export const MAX_PR_REVIEW_DIFF_CHARS = 80_000;

export type PullRequestFindingSeverity = "critical" | "warning" | "suggestion";
export type PullRequestReviewVerdict = "approve" | "request_changes" | "comment";

export interface PullRequestFinding {
  severity: PullRequestFindingSeverity;
  /** A short category such as bug, security, performance, testing, or readability. */
  category: string;
  file: string;
  /** 1-based line in the new version of the file. */
  line: number;
  endLine: number;
  title: string;
  body: string;
  /** An optional suggested fix, as a small code snippet. */
  suggestion?: string;
}

export interface PullRequestReviewResult {
  summary: string;
  verdict: PullRequestReviewVerdict;
  findings: PullRequestFinding[];
}

export const PR_REVIEW_SYSTEM_PROMPT = [
  "You review a GitHub pull request's unified diff for real problems only: logic errors,",
  "crashes, resource leaks, race conditions, off-by-one mistakes, unhandled errors, security",
  "flaws, and missing tests for changed behavior. Ignore pure style, formatting, and naming.",
  "Output ONLY a JSON object, with no prose and no code fences.",
  'Shape: {"verdict": "approve" | "request_changes" | "comment", "summary": "<2-3 sentences>",',
  '"findings": [{"severity": "critical" | "warning" | "suggestion", "category": "<one word>",',
  '"file": "<path>", "line": <number>, "endLine": <number>, "title": "<short>",',
  '"body": "<one paragraph, why it is a problem>", "suggestion": "<optional code fix>"}]}',
  "Line numbers are 1-based and refer to the new version of the file.",
  "Report at most one finding per distinct problem. If the change is clean, return an empty findings array.",
].join(" ");

const SEVERITY_BY_NAME: Record<string, PullRequestFindingSeverity> = {
  critical: "critical",
  error: "critical",
  bug: "critical",
  high: "critical",
  warning: "warning",
  warn: "warning",
  medium: "warning",
  suggestion: "suggestion",
  info: "suggestion",
  nit: "suggestion",
  low: "suggestion",
};

const VERDICT_BY_NAME: Record<string, PullRequestReviewVerdict> = {
  approve: "approve",
  approved: "approve",
  lgtm: "approve",
  request_changes: "request_changes",
  "request changes": "request_changes",
  reject: "request_changes",
  comment: "comment",
  comments: "comment",
};

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

function readText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const withoutFences = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  if (withoutFences === "") return null;

  const candidates = [withoutFences];
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");

  if (start >= 0 && end > start) {
    candidates.push(withoutFences.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function toFinding(value: unknown, files: Set<string>): PullRequestFinding | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const file = readText(item.file, 300).replace(/^[ab]\//, "");
  const title = readText(item.title, 300);
  const body = readText(item.body, 4_000);

  if (file === "" || title === "" || body === "") return null;
  if (files.size > 0 && !files.has(file)) return null;

  const rawLine = readNumeric(item.line);
  const line = rawLine === null ? 1 : Math.max(1, Math.round(rawLine));
  const rawEndLine = readNumeric(item.endLine);
  const endLine = rawEndLine === null ? line : Math.max(line, Math.round(rawEndLine));
  const severityName = readText(item.severity, 40).toLowerCase();
  const suggestion = readText(item.suggestion, 4_000);

  return {
    severity: SEVERITY_BY_NAME[severityName] ?? "warning",
    category: readText(item.category, 40).toLowerCase() || "general",
    file,
    line,
    endLine,
    title,
    body,
    ...(suggestion ? { suggestion } : {}),
  };
}

export function parsePullRequestReview(
  text: string,
  changedFiles: string[],
): PullRequestReviewResult {
  const parsed = extractJsonObject(text);

  if (!parsed) return { summary: "", verdict: "comment", findings: [] };

  const files = new Set(changedFiles);
  const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings: PullRequestFinding[] = [];
  const seen = new Set<string>();

  for (const value of rawFindings) {
    const finding = toFinding(value, files);

    if (!finding) continue;

    const key = `${finding.file}:${finding.line}:${finding.title}`;

    if (seen.has(key)) continue;

    seen.add(key);
    findings.push(finding);

    if (findings.length >= MAX_PR_REVIEW_FINDINGS) break;
  }

  const verdictName = readText(parsed.verdict, 40).toLowerCase();

  return {
    summary: readText(parsed.summary, 4_000),
    verdict: VERDICT_BY_NAME[verdictName] ?? (findings.length > 0 ? "request_changes" : "comment"),
    findings,
  };
}

export function buildPullRequestReviewPrompt(input: {
  repository: string;
  number: number;
  title: string;
  body: string;
  files: string[];
  diff: string;
}): string {
  const diff =
    input.diff.length > MAX_PR_REVIEW_DIFF_CHARS
      ? `${input.diff.slice(0, MAX_PR_REVIEW_DIFF_CHARS)}\n... (diff truncated)`
      : input.diff;
  const body =
    input.body.length > 4_000 ? `${input.body.slice(0, 4_000)}\n... (truncated)` : input.body;

  return [
    `Repository: ${input.repository}`,
    `Pull request #${input.number}: ${input.title}`,
    "",
    "Description:",
    body || "(no description)",
    "",
    "Changed files:",
    ...input.files.map((file) => `- ${file}`),
    "",
    "Unified diff:",
    "```diff",
    diff,
    "```",
  ].join("\n");
}
