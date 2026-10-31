use crate::models::{
   Capsule, CapsuleContextItem, CapsuleEvidence, CapsuleRun, CapsuleWithChildren,
};
use rusqlite::{Connection, params};
use std::path::PathBuf;

/// Longest log kept in a row. Full output belongs in the caller's artifact store.
pub const MAX_LOG_CHARS: usize = 256_000;

pub struct CapsuleRepository {
   db_path: PathBuf,
}

impl CapsuleRepository {
   pub fn new(db_path: PathBuf) -> Self {
      Self { db_path }
   }

   fn open_connection(&self) -> Result<Connection, String> {
      if let Some(parent) = self.db_path.parent() {
         std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create capsule database directory: {e}"))?;
      }
      let conn = Connection::open(&self.db_path)
         .map_err(|e| format!("Failed to open capsule database: {e}"))?;
      conn
         .execute("PRAGMA foreign_keys = ON", [])
         .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;
      Ok(conn)
   }

   pub fn initialize(&self) -> Result<(), String> {
      let conn = self.open_connection()?;

      conn
         .execute(
            "CREATE TABLE IF NOT EXISTS capsules (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            risk TEXT NOT NULL,
            intent TEXT,
            policy TEXT,
            base_sha TEXT,
            branch TEXT,
            worktree_path TEXT,
            diagnosis TEXT,
            revision INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
         )",
            [],
         )
         .map_err(|e| format!("Failed to create capsules table: {e}"))?;

      conn
         .execute(
            "CREATE TABLE IF NOT EXISTS capsule_context (
            id TEXT PRIMARY KEY,
            capsule_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            url TEXT,
            captured_at INTEGER NOT NULL,
            redaction TEXT,
            FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
         )",
            [],
         )
         .map_err(|e| format!("Failed to create capsule_context table: {e}"))?;

      conn
         .execute(
            "CREATE TABLE IF NOT EXISTS capsule_runs (
            id TEXT PRIMARY KEY,
            capsule_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            command TEXT NOT NULL,
            cwd TEXT,
            exit_code INTEGER,
            duration_ms INTEGER NOT NULL,
            log TEXT,
            log_truncated BOOLEAN NOT NULL DEFAULT 0,
            files_changed TEXT,
            started_at INTEGER NOT NULL,
            FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
         )",
            [],
         )
         .map_err(|e| format!("Failed to create capsule_runs table: {e}"))?;

      conn
         .execute(
            "CREATE TABLE IF NOT EXISTS capsule_evidence (
            id TEXT PRIMARY KEY,
            capsule_id TEXT NOT NULL,
            run_id TEXT,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            artifact_path TEXT,
            FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
         )",
            [],
         )
         .map_err(|e| format!("Failed to create capsule_evidence table: {e}"))?;

      conn
         .execute(
            "CREATE INDEX IF NOT EXISTS idx_capsule_context_capsule
            ON capsule_context(capsule_id, captured_at)",
            [],
         )
         .map_err(|e| format!("Failed to create capsule_context index: {e}"))?;

      conn
         .execute(
            "CREATE INDEX IF NOT EXISTS idx_capsule_runs_capsule
            ON capsule_runs(capsule_id, started_at)",
            [],
         )
         .map_err(|e| format!("Failed to create capsule_runs index: {e}"))?;

      conn
         .execute(
            "CREATE INDEX IF NOT EXISTS idx_capsules_project
            ON capsules(project_id, updated_at DESC)",
            [],
         )
         .map_err(|e| format!("Failed to create capsules index: {e}"))?;

      Ok(())
   }

   /// Inserts the capsule, or updates the mutable fields of the one with the same id and bumps
   /// its revision. Returns the revision the row holds afterwards.
   pub fn save_capsule(&self, capsule: &Capsule) -> Result<i64, String> {
      let conn = self.open_connection()?;
      conn
         .execute(
            "INSERT INTO capsules (
            id, project_id, title, status, risk, intent, policy, base_sha, branch,
            worktree_path, diagnosis, revision, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            status = excluded.status,
            risk = excluded.risk,
            intent = excluded.intent,
            policy = excluded.policy,
            base_sha = excluded.base_sha,
            branch = excluded.branch,
            worktree_path = excluded.worktree_path,
            diagnosis = excluded.diagnosis,
            updated_at = excluded.updated_at,
            revision = capsules.revision + 1",
            params![
               capsule.id,
               capsule.project_id,
               capsule.title,
               capsule.status,
               capsule.risk,
               capsule.intent,
               capsule.policy,
               capsule.base_sha,
               capsule.branch,
               capsule.worktree_path,
               capsule.diagnosis,
               capsule.revision,
               capsule.created_at,
               capsule.updated_at
            ],
         )
         .map_err(|e| format!("Failed to save capsule: {e}"))?;

      conn
         .query_row(
            "SELECT revision FROM capsules WHERE id = ?1",
            params![capsule.id],
            |row| row.get(0),
         )
         .map_err(|e| format!("Failed to read capsule revision: {e}"))
   }

   pub fn load_capsule(&self, capsule_id: &str) -> Result<CapsuleWithChildren, String> {
      let conn = self.open_connection()?;
      let capsule = conn
         .query_row(
            "SELECT id, project_id, title, status, risk, intent, policy, base_sha, branch,
                    worktree_path, diagnosis, revision, created_at, updated_at
             FROM capsules WHERE id = ?1",
            params![capsule_id],
            |row| {
               Ok(Capsule {
                  id: row.get(0)?,
                  project_id: row.get(1)?,
                  title: row.get(2)?,
                  status: row.get(3)?,
                  risk: row.get(4)?,
                  intent: row.get(5)?,
                  policy: row.get(6)?,
                  base_sha: row.get(7)?,
                  branch: row.get(8)?,
                  worktree_path: row.get(9)?,
                  diagnosis: row.get(10)?,
                  revision: row.get(11)?,
                  created_at: row.get(12)?,
                  updated_at: row.get(13)?,
               })
            },
         )
         .map_err(|e| format!("Failed to load capsule: {e}"))?;

      let mut context_statement = conn
         .prepare(
            "SELECT id, capsule_id, kind, source, title, body, url, captured_at, redaction
             FROM capsule_context WHERE capsule_id = ?1 ORDER BY captured_at",
         )
         .map_err(|e| format!("Failed to prepare context query: {e}"))?;
      let context = context_statement
         .query_map(params![capsule_id], |row| {
            Ok(CapsuleContextItem {
               id: row.get(0)?,
               capsule_id: row.get(1)?,
               kind: row.get(2)?,
               source: row.get(3)?,
               title: row.get(4)?,
               body: row.get(5)?,
               url: row.get(6)?,
               captured_at: row.get(7)?,
               redaction: row.get(8)?,
            })
         })
         .map_err(|e| format!("Failed to read capsule context: {e}"))?
         .collect::<Result<Vec<_>, _>>()
         .map_err(|e| format!("Failed to read capsule context rows: {e}"))?;

      let mut run_statement = conn
         .prepare(
            "SELECT id, capsule_id, kind, command, cwd, exit_code, duration_ms, log,
                    log_truncated, files_changed, started_at
             FROM capsule_runs WHERE capsule_id = ?1 ORDER BY started_at",
         )
         .map_err(|e| format!("Failed to prepare runs query: {e}"))?;
      let runs = run_statement
         .query_map(params![capsule_id], |row| {
            Ok(CapsuleRun {
               id: row.get(0)?,
               capsule_id: row.get(1)?,
               kind: row.get(2)?,
               command: row.get(3)?,
               cwd: row.get(4)?,
               exit_code: row.get(5)?,
               duration_ms: row.get(6)?,
               log: row.get(7)?,
               log_truncated: row.get(8)?,
               files_changed: row.get(9)?,
               started_at: row.get(10)?,
            })
         })
         .map_err(|e| format!("Failed to read capsule runs: {e}"))?
         .collect::<Result<Vec<_>, _>>()
         .map_err(|e| format!("Failed to read capsule run rows: {e}"))?;

      let mut evidence_statement = conn
         .prepare(
            "SELECT id, capsule_id, run_id, kind, status, title, summary, artifact_path
             FROM capsule_evidence WHERE capsule_id = ?1",
         )
         .map_err(|e| format!("Failed to prepare evidence query: {e}"))?;
      let evidence = evidence_statement
         .query_map(params![capsule_id], |row| {
            Ok(CapsuleEvidence {
               id: row.get(0)?,
               capsule_id: row.get(1)?,
               run_id: row.get(2)?,
               kind: row.get(3)?,
               status: row.get(4)?,
               title: row.get(5)?,
               summary: row.get(6)?,
               artifact_path: row.get(7)?,
            })
         })
         .map_err(|e| format!("Failed to read capsule evidence: {e}"))?
         .collect::<Result<Vec<_>, _>>()
         .map_err(|e| format!("Failed to read capsule evidence rows: {e}"))?;

      Ok(CapsuleWithChildren {
         capsule,
         context,
         runs,
         evidence,
      })
   }

   pub fn list_capsules(&self, project_id: &str) -> Result<Vec<Capsule>, String> {
      let conn = self.open_connection()?;
      let mut statement = conn
         .prepare(
            "SELECT id, project_id, title, status, risk, intent, policy, base_sha, branch,
                    worktree_path, diagnosis, revision, created_at, updated_at
             FROM capsules WHERE project_id = ?1 ORDER BY updated_at DESC",
         )
         .map_err(|e| format!("Failed to prepare capsule list: {e}"))?;
      let capsules = statement
         .query_map(params![project_id], |row| {
            Ok(Capsule {
               id: row.get(0)?,
               project_id: row.get(1)?,
               title: row.get(2)?,
               status: row.get(3)?,
               risk: row.get(4)?,
               intent: row.get(5)?,
               policy: row.get(6)?,
               base_sha: row.get(7)?,
               branch: row.get(8)?,
               worktree_path: row.get(9)?,
               diagnosis: row.get(10)?,
               revision: row.get(11)?,
               created_at: row.get(12)?,
               updated_at: row.get(13)?,
            })
         })
         .map_err(|e| format!("Failed to list capsules: {e}"))?
         .collect::<Result<Vec<_>, _>>()
         .map_err(|e| format!("Failed to read capsule rows: {e}"))?;
      Ok(capsules)
   }

   pub fn delete_capsule(&self, capsule_id: &str) -> Result<(), String> {
      let conn = self.open_connection()?;
      conn
         .execute("DELETE FROM capsules WHERE id = ?1", params![capsule_id])
         .map_err(|e| format!("Failed to delete capsule: {e}"))?;
      Ok(())
   }

   pub fn add_context(&self, item: &CapsuleContextItem) -> Result<(), String> {
      let conn = self.open_connection()?;
      conn
         .execute(
            "INSERT INTO capsule_context (id, capsule_id, kind, source, title, body, url, \
             captured_at, redaction)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
               item.id,
               item.capsule_id,
               item.kind,
               item.source,
               item.title,
               item.body,
               item.url,
               item.captured_at,
               item.redaction
            ],
         )
         .map_err(|e| format!("Failed to add capsule context: {e}"))?;
      Ok(())
   }

   /// Stores a run, trimming its log to what a row can hold. The returned flag says whether the
   /// log was trimmed, so the caller knows the full output lives elsewhere.
   pub fn add_run(&self, run: &CapsuleRun) -> Result<bool, String> {
      let conn = self.open_connection()?;
      let (log, truncated) = truncate_log(run.log.as_deref());
      conn
         .execute(
            "INSERT INTO capsule_runs (id, capsule_id, kind, command, cwd, exit_code, duration_ms,
                                    log, log_truncated, files_changed, started_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
               run.id,
               run.capsule_id,
               run.kind,
               run.command,
               run.cwd,
               run.exit_code,
               run.duration_ms,
               log,
               truncated,
               run.files_changed,
               run.started_at
            ],
         )
         .map_err(|e| format!("Failed to add capsule run: {e}"))?;
      Ok(truncated)
   }

   pub fn add_evidence(&self, evidence: &CapsuleEvidence) -> Result<(), String> {
      let conn = self.open_connection()?;
      conn
         .execute(
            "INSERT INTO capsule_evidence (id, capsule_id, run_id, kind, status, title, summary, \
             artifact_path)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
               evidence.id,
               evidence.capsule_id,
               evidence.run_id,
               evidence.kind,
               evidence.status,
               evidence.title,
               evidence.summary,
               evidence.artifact_path
            ],
         )
         .map_err(|e| format!("Failed to add capsule evidence: {e}"))?;
      Ok(())
   }
}

fn truncate_log(log: Option<&str>) -> (Option<String>, bool) {
   match log {
      None => (None, false),
      Some(text) if text.chars().count() <= MAX_LOG_CHARS => (Some(text.to_string()), false),
      Some(text) => (
         Some(text.chars().take(MAX_LOG_CHARS).collect::<String>()),
         true,
      ),
   }
}

#[cfg(test)]
mod tests {
   use super::*;
   use tempfile::TempDir;

   fn repository() -> (CapsuleRepository, TempDir) {
      let directory = TempDir::new().expect("temp dir");
      let repository = CapsuleRepository::new(directory.path().join("capsules.db"));
      repository.initialize().expect("initialize");
      (repository, directory)
   }

   fn capsule(id: &str) -> Capsule {
      Capsule {
         id: id.to_string(),
         project_id: "blimydev/blimy".to_string(),
         title: "Export returns 500".to_string(),
         status: "open".to_string(),
         risk: "medium".to_string(),
         intent: None,
         policy: None,
         base_sha: None,
         branch: None,
         worktree_path: None,
         diagnosis: None,
         revision: 0,
         created_at: 1,
         updated_at: 1,
      }
   }

   #[test]
   fn saves_and_reloads_children() {
      let (repository, _directory) = repository();
      repository
         .save_capsule(&capsule("capsule-1"))
         .expect("save");
      repository
         .add_context(&CapsuleContextItem {
            id: "context-1".to_string(),
            capsule_id: "capsule-1".to_string(),
            kind: "error".to_string(),
            source: "terminal".to_string(),
            title: "IntegrityError".to_string(),
            body: Some("duplicate key".to_string()),
            url: None,
            captured_at: 2,
            redaction: None,
         })
         .expect("add context");

      let loaded = repository.load_capsule("capsule-1").expect("load");
      assert_eq!(loaded.capsule.title, "Export returns 500");
      assert_eq!(loaded.context.len(), 1);
      assert_eq!(loaded.context[0].source, "terminal");
      assert!(loaded.runs.is_empty());
      assert!(loaded.evidence.is_empty());
   }

   #[test]
   fn save_bumps_revision() {
      let (repository, _directory) = repository();
      let first = repository
         .save_capsule(&capsule("capsule-1"))
         .expect("save");
      assert_eq!(first, 0);

      let mut updated = capsule("capsule-1");
      updated.title = "Renamed".to_string();
      updated.updated_at = 5;
      let second = repository.save_capsule(&updated).expect("save again");

      assert_eq!(second, 1);
      let loaded = repository.load_capsule("capsule-1").expect("load");
      assert_eq!(loaded.capsule.title, "Renamed");
   }

   #[test]
   fn deleting_a_capsule_removes_its_children() {
      let (repository, _directory) = repository();
      repository
         .save_capsule(&capsule("capsule-1"))
         .expect("save");
      repository
         .add_evidence(&CapsuleEvidence {
            id: "evidence-1".to_string(),
            capsule_id: "capsule-1".to_string(),
            run_id: None,
            kind: "test".to_string(),
            status: "passed".to_string(),
            title: "Regression test passes".to_string(),
            summary: None,
            artifact_path: None,
         })
         .expect("add evidence");

      repository.delete_capsule("capsule-1").expect("delete");

      assert!(repository.load_capsule("capsule-1").is_err());
   }

   #[test]
   fn a_log_longer_than_the_row_is_trimmed_and_flagged() {
      let (repository, _directory) = repository();
      repository
         .save_capsule(&capsule("capsule-1"))
         .expect("save");
      let long = "x".repeat(MAX_LOG_CHARS + 10);
      let truncated = repository
         .add_run(&CapsuleRun {
            id: "run-1".to_string(),
            capsule_id: "capsule-1".to_string(),
            kind: "unit".to_string(),
            command: "bun test".to_string(),
            cwd: None,
            exit_code: Some(1),
            duration_ms: 12,
            log: Some(long),
            log_truncated: false,
            files_changed: None,
            started_at: 3,
         })
         .expect("add run");

      assert!(truncated);
      let loaded = repository.load_capsule("capsule-1").expect("load");
      assert_eq!(loaded.runs[0].exit_code, Some(1));
      assert_eq!(
         loaded.runs[0].log.as_deref().map(str::len),
         Some(MAX_LOG_CHARS)
      );
   }
}
