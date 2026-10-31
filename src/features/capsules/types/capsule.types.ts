/** One problem a developer is working on: the error, its context, the runs, and the proof. */
export interface Capsule {
  id: string;
  /** The repository the capsule belongs to, as `owner/name` when a remote exists. */
  project_id: string;
  title: string;
  status: CapsuleStatus;
  risk: CapsuleRisk;
  /** The goal and acceptance criteria, as JSON. */
  intent: string | null;
  /** The `blimy.json` policy snapshot taken when the capsule was created, as JSON. */
  policy: string | null;
  base_sha: string | null;
  branch: string | null;
  worktree_path: string | null;
  /** The ranked causes and the chosen one, as JSON. */
  diagnosis: string | null;
  /** Bumped on every write, so a stale copy cannot silently overwrite a newer one. */
  revision: number;
  created_at: number;
  updated_at: number;
}

export type CapsuleStatus = "open" | "reproducing" | "fixing" | "verifying" | "done" | "abandoned";

export type CapsuleRisk = "low" | "medium" | "high";

/** A cited piece of evidence about the problem: an error, a log, a request, an issue. */
export interface CapsuleContextItem {
  id: string;
  capsule_id: string;
  kind: CapsuleContextKind;
  source: CapsuleContextSource;
  title: string;
  body: string | null;
  url: string | null;
  captured_at: number;
  /** What was redacted before this row was stored, as JSON. */
  redaction: string | null;
}

export type CapsuleContextKind =
  | "error"
  | "log"
  | "trace"
  | "request"
  | "diff"
  | "issue"
  | "pr"
  | "decision"
  | "commit"
  | "note";

export type CapsuleContextSource =
  | "sentry"
  | "github"
  | "linear"
  | "slack"
  | "terminal"
  | "browser"
  | "api_run"
  | "code"
  | "manual";

/** One command that was actually executed, with the result it actually produced. */
export interface CapsuleRun {
  id: string;
  capsule_id: string;
  kind: CapsuleRunKind;
  command: string;
  cwd: string | null;
  /** `null` when the command never reported one, so it is never read as success. */
  exit_code: number | null;
  duration_ms: number;
  log: string | null;
  log_truncated: boolean;
  /** The files the command changed, as JSON. */
  files_changed: string | null;
  started_at: number;
}

export type CapsuleRunKind =
  | "typecheck"
  | "lint"
  | "unit"
  | "integration"
  | "e2e"
  | "repro"
  | "api_check"
  | "security";

/** What a run, or a group of runs, proves about the change. */
export interface CapsuleEvidence {
  id: string;
  capsule_id: string;
  run_id: string | null;
  kind: string;
  status: CapsuleEvidenceStatus;
  title: string;
  summary: string | null;
  artifact_path: string | null;
}

export type CapsuleEvidenceStatus = "passed" | "failed" | "skipped" | "needs_review";

export interface CapsuleWithChildren {
  capsule: Capsule;
  context: CapsuleContextItem[];
  runs: CapsuleRun[];
  evidence: CapsuleEvidence[];
}
