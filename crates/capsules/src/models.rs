use serde::{Deserialize, Serialize};

/// One problem a developer is working on: the error, the context around it, what ran,
/// and what proved the fix. Everything else in this crate hangs off a capsule.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Capsule {
   pub id: String,
   /// The repository the capsule belongs to, as `owner/name` when a remote exists.
   pub project_id: String,
   pub title: String,
   pub status: String,
   pub risk: String,
   /// The goal and acceptance criteria, as JSON.
   #[serde(default)]
   pub intent: Option<String>,
   /// The `blimy.json` policy snapshot taken when the capsule was created, as JSON.
   #[serde(default)]
   pub policy: Option<String>,
   #[serde(default)]
   pub base_sha: Option<String>,
   #[serde(default)]
   pub branch: Option<String>,
   #[serde(default)]
   pub worktree_path: Option<String>,
   /// The ranked causes and the chosen one, as JSON.
   #[serde(default)]
   pub diagnosis: Option<String>,
   /// Bumped on every write so a stale copy cannot silently overwrite a newer one.
   pub revision: i64,
   pub created_at: i64,
   pub updated_at: i64,
}

/// A cited piece of evidence about the problem: an error, a log, a request, an issue.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleContextItem {
   pub id: String,
   pub capsule_id: String,
   /// error, log, trace, request, diff, issue, pr, decision, commit, note.
   pub kind: String,
   /// sentry, github, linear, slack, terminal, browser, api_run, code, manual.
   pub source: String,
   pub title: String,
   #[serde(default)]
   pub body: Option<String>,
   #[serde(default)]
   pub url: Option<String>,
   pub captured_at: i64,
   /// What was redacted before this row was stored, as JSON.
   #[serde(default)]
   pub redaction: Option<String>,
}

/// One command that was actually executed, with the result it actually produced.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleRun {
   pub id: String,
   pub capsule_id: String,
   /// typecheck, lint, unit, integration, e2e, repro, api_check, security.
   pub kind: String,
   pub command: String,
   #[serde(default)]
   pub cwd: Option<String>,
   /// `None` when the command never reported one, so it is never read as success.
   #[serde(default)]
   pub exit_code: Option<i32>,
   pub duration_ms: i64,
   #[serde(default)]
   pub log: Option<String>,
   pub log_truncated: bool,
   /// The files the command changed, as JSON.
   #[serde(default)]
   pub files_changed: Option<String>,
   pub started_at: i64,
}

/// What a run, or a group of runs, proves about the change.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleEvidence {
   pub id: String,
   pub capsule_id: String,
   #[serde(default)]
   pub run_id: Option<String>,
   pub kind: String,
   /// passed, failed, skipped, needs_review.
   pub status: String,
   pub title: String,
   #[serde(default)]
   pub summary: Option<String>,
   #[serde(default)]
   pub artifact_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleWithChildren {
   pub capsule: Capsule,
   pub context: Vec<CapsuleContextItem>,
   pub runs: Vec<CapsuleRun>,
   pub evidence: Vec<CapsuleEvidence>,
}
