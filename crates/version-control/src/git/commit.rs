use crate::git::{GitCommit, IntoStringError, RepositoryHost};
use anyhow::{Context, Result};
use git2::{Repository, Sort};
use std::path::Path;

pub fn git_commit(repo_path: String, message: String) -> Result<(), String> {
   _git_commit(repo_path, message).into_string_error()
}

fn _git_commit(repo_path: String, message: String) -> Result<()> {
   let host = RepositoryHost::detect(&repo_path);
   if host.uses_distro_git() {
      host
         .git()
         .args(["commit", "-q", "-F", "-"])
         .stdin(message.into_bytes())
         .run("commit")?;
      return Ok(());
   }

   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   let mut index = repo.index().context("Failed to get index")?;

   let tree_id = index.write_tree().context("Failed to write tree")?;
   let tree = repo.find_tree(tree_id).context("Failed to find tree")?;
   let sig = repo.signature().context("Failed to get signature")?;
   let head = repo.head().context("Failed to get HEAD")?;
   let parent_commit = head
      .peel_to_commit()
      .context("Failed to get parent commit")?;

   repo
      .commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent_commit])
      .context("Failed to create commit")?;

   Ok(())
}

pub fn git_log(
   repo_path: String,
   limit: Option<u32>,
   skip: Option<u32>,
) -> Result<Vec<GitCommit>, String> {
   _git_log(repo_path, limit, skip).into_string_error()
}

pub fn git_log_for_path(
   repo_path: String,
   file_path: String,
   limit: Option<u32>,
) -> Result<Vec<GitCommit>, String> {
   _git_log_for_path(repo_path, file_path, limit).into_string_error()
}

/// Commits that touched one file, most recent first.
fn _git_log_for_path(
   repo_path: String,
   file_path: String,
   limit: Option<u32>,
) -> Result<Vec<GitCommit>> {
   // An empty path would silently match the whole history, so treat it as no
   // history at all rather than showing unrelated commits.
   if file_path.trim().is_empty() {
      return Ok(Vec::new());
   }

   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   // The editor sends an absolute path, but a tree is keyed by a path relative
   // to the repository root, so this has to be translated before any lookup.
   let repo_relative_path = to_repo_relative_path(&repo, &file_path);
   let mut revwalk = repo.revwalk().context("Failed to create revwalk")?;

   revwalk.push_head().context("Failed to push HEAD")?;
   // Time alone lets a child sort ahead of its parent when two commits share a
   // timestamp, and this walk reports a chain of edits to one file, so the
   // parent has to be able to follow its child. Topological sorting guarantees
   // that and still favours the newest commit first within a generation.
   revwalk
      .set_sorting(Sort::TOPOLOGICAL | Sort::TIME)
      .context("Failed to set sorting")?;

   let limit = limit.unwrap_or(50) as usize;
   let mut commits = Vec::new();
   // A rename changes the name the file is tracked under, so the walk carries
   // the current name with it and keeps following the file backwards.
   let mut tracked_path = repo_relative_path;

   for oid in revwalk.flatten() {
      if commits.len() >= limit {
         break;
      }

      let Ok(commit) = repo.find_commit(oid) else {
         continue;
      };

      let Some(next_path) = commit_touches_path(&repo, &commit, &tracked_path) else {
         continue;
      };

      commits.push(to_git_commit(&commit, &oid.to_string()));
      tracked_path = next_path;
   }

   Ok(commits)
}

/// Whether a commit changed one path, and the name the file was tracked under
/// before that commit. Returning the previous name is what lets the walk follow
/// a file backwards through a rename instead of stopping at it, which would
/// leave a renamed file looking like it was created at the new name.
///
/// Comparing blob ids rather than testing whether the path exists is what keeps
/// unrelated commits out: with an existence check every commit that still
/// carries the file would report a touch.
fn commit_touches_path(
   repo: &Repository,
   commit: &git2::Commit,
   file_path: &str,
) -> Option<String> {
   let current = commit.tree().ok()?;
   let current_blob = blob_id(repo, &current, file_path);

   // The first commit in history has no parent, so existence is the only change
   // there can be.
   let Some(parent) = commit.parent(0).ok() else {
      return current_blob.map(|_| file_path.to_string());
   };
   let previous = parent.tree().ok()?;
   let parent_blob = blob_id(repo, &previous, file_path);

   if current_blob == parent_blob {
      return None;
   }

   // A path that appeared holding a blob the parent already had under a
   // different name was renamed, so keep following the old name.
   Some(match current_blob {
      Some(blob) if parent_blob.is_none() => {
         previous_name_holding_blob(&previous, blob).unwrap_or_else(|| file_path.to_string())
      }
      _ => file_path.to_string(),
   })
}

/// Tree lookups need a path relative to the repository root with `/`
/// separators. An editor path is usually absolute, so it is rebased here. A
/// path that cannot be rebased is passed through unchanged and will simply fail
/// to match anything.
fn to_repo_relative_path(repo: &Repository, file_path: &str) -> String {
   let normalized = file_path.replace('\\', "/");

   let Some(workdir) = repo.workdir() else {
      return normalized;
   };
   let workdir = workdir.to_string_lossy().replace('\\', "/");
   let workdir = workdir.trim_end_matches('/');

   match normalized.strip_prefix(workdir) {
      Some(relative) => relative.trim_start_matches('/').to_string(),
      None => normalized,
   }
}

fn blob_id(repo: &Repository, tree: &git2::Tree, file_path: &str) -> Option<git2::Oid> {
   tree.get_path(Path::new(file_path))
      .ok()
      .and_then(|entry| entry.to_object(repo).ok())
      .map(|object| object.id())
}

/// The full path of a blob elsewhere in a tree, which is the name a file had
/// before it was renamed to where it is now.
fn previous_name_holding_blob(tree: &git2::Tree, blob: git2::Oid) -> Option<String> {
   let mut found = None;
   let _ = tree.walk(git2::TreeWalkMode::PreOrder, |root, tree_entry| {
      if tree_entry.kind() == Some(git2::ObjectType::Blob) && tree_entry.id() == blob {
         found = Some(format!("{root}{}", tree_entry.name().unwrap_or_default()));
         return git2::TreeWalkResult::Abort;
      }
      git2::TreeWalkResult::Ok
   });
   found
}

fn to_git_commit(commit: &git2::Commit, hash: &str) -> GitCommit {
   let author = commit.author();
   let date = chrono::DateTime::<chrono::Utc>::from_timestamp(author.when().seconds(), 0)
      .map(|dt| dt.format("%Y-%m-%d").to_string())
      .unwrap_or_default();

   GitCommit {
      hash: hash.to_string(),
      message: commit.summary().unwrap_or("").to_string(),
      description: commit
         .body()
         .map(str::trim)
         .filter(|body| !body.is_empty())
         .map(str::to_string),
      author: author.name().unwrap_or("Unknown").to_string(),
      email: author.email().unwrap_or("").to_string(),
      date,
   }
}

fn _git_log(repo_path: String, limit: Option<u32>, skip: Option<u32>) -> Result<Vec<GitCommit>> {
   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   let mut revwalk = repo.revwalk().context("Failed to create revwalk")?;

   revwalk.push_head().context("Failed to push HEAD")?;
   revwalk
      .set_sorting(Sort::TIME)
      .context("Failed to set sorting")?;

   let skip = skip.unwrap_or(0) as usize;
   let limit = limit.unwrap_or(50) as usize;
   let mut commits = Vec::new();

   for (_idx, oid) in revwalk.enumerate().skip(skip).take(limit) {
      let oid = oid.context("Failed to get commit oid")?;
      let commit = repo.find_commit(oid).context("Failed to find commit")?;

      let author = commit.author();
      let time = chrono::DateTime::<chrono::Utc>::from_timestamp(author.when().seconds(), 0)
         .map(|dt| dt.format("%Y-%m-%d").to_string())
         .unwrap_or_default();

      commits.push(GitCommit {
         hash: oid.to_string(),
         message: commit.summary().unwrap_or("").to_string(),
         description: commit
            .body()
            .map(str::trim)
            .filter(|body| !body.is_empty())
            .map(str::to_string),
         author: author.name().unwrap_or("Unknown").to_string(),
         email: author.email().unwrap_or("").to_string(),
         date: time,
      });
   }

   Ok(commits)
}

#[cfg(test)]
mod tests {
   use super::*;

   struct TestRepo {
      _dir: tempfile::TempDir,
      repo: Repository,
      signature: git2::Signature<'static>,
   }

   impl TestRepo {
      fn new() -> Self {
         let dir = tempfile::tempdir().expect("temp dir");
         let repo = Repository::init(dir.path()).expect("init repo");
         let signature = git2::Signature::now("Blimy", "blimy@example.com").expect("signature");
         Self {
            _dir: dir,
            repo,
            signature,
         }
      }

      fn write(&self, relative: &str, content: &str) {
         let path = self.repo.workdir().expect("workdir").join(relative);
         if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("create parent");
         }
         std::fs::write(&path, content).expect("write file");
         let mut index = self.repo.index().expect("index");
         index.add_path(Path::new(relative)).expect("add path");
         index.write().expect("write index");
      }

      fn remove_from_index(&self, relative: &str) {
         let mut index = self.repo.index().expect("index");
         index.remove_path(Path::new(relative)).expect("remove path");
         index.write().expect("write index");
      }

      fn rename_file(&self, from: &str, to: &str) {
         let workdir = self.repo.workdir().expect("workdir");
         std::fs::rename(workdir.join(from), workdir.join(to)).expect("rename on disk");
         let mut index = self.repo.index().expect("index");
         index.remove_path(Path::new(from)).expect("remove old");
         index.add_path(Path::new(to)).expect("add new");
         index.write().expect("write index");
      }

      fn commit(&self, message: &str) {
         let tree_id = self.repo.index().expect("index").write_tree().expect("write tree");
         let tree = self.repo.find_tree(tree_id).expect("find tree");
         let parents: Vec<git2::Commit> = match self.repo.head() {
            Ok(head) => vec![head.peel_to_commit().expect("peel head")],
            Err(_) => Vec::new(),
         };
         let parent_refs: Vec<&git2::Commit> = parents.iter().collect();
         self.repo
            .commit(
               Some("HEAD"),
               &self.signature,
               &self.signature,
               message,
               &tree,
               &parent_refs,
            )
            .expect("commit");
      }

      fn workdir(&self) -> String {
         self.repo
            .workdir()
            .expect("workdir")
            .to_string_lossy()
            .replace('\\', "/")
      }

      fn messages(&self, file_path: &str) -> Vec<String> {
         let absolute = format!("{}/{file_path}", self.workdir());
         _git_log_for_path(self.workdir(), absolute, None)
            .expect("log for path")
            .into_iter()
            .map(|entry| entry.message)
            .collect()
      }
   }

   #[test]
   fn only_reports_commits_that_changed_the_file() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("add tracked");
      repo.write("other.txt", "one");
      repo.commit("add other");
      repo.write("tracked.txt", "two");
      repo.commit("change tracked");

      assert_eq!(repo.messages("tracked.txt"), ["change tracked", "add tracked"]);
   }

   #[test]
   fn reports_the_creation_commit_of_a_file() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("add tracked");
      repo.write("other.txt", "one");
      repo.commit("add other");

      assert_eq!(repo.messages("tracked.txt"), ["add tracked"]);
   }

   #[test]
   fn reports_the_deletion_commit_of_a_file() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("add tracked");

      std::fs::remove_file(repo.repo.workdir().expect("workdir").join("tracked.txt"))
         .expect("delete file");
      repo.remove_from_index("tracked.txt");
      repo.commit("delete tracked");

      assert_eq!(
         repo.messages("tracked.txt"),
         ["delete tracked", "add tracked"]
      );
   }

   #[test]
   fn follows_a_file_across_a_rename() {
      let repo = TestRepo::new();
      repo.write("old-name.txt", "one");
      repo.commit("add old name");
      repo.rename_file("old-name.txt", "new-name.txt");
      repo.commit("rename to new name");
      repo.write("new-name.txt", "two");
      repo.commit("change after rename");

      assert_eq!(
         repo.messages("new-name.txt"),
         ["change after rename", "rename to new name", "add old name"]
      );
   }

   #[test]
   fn ignores_a_file_outside_the_repository() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("add tracked");

      let workdir = repo.workdir();
      let outside = format!("{workdir}/../outside.txt");

      assert!(
         _git_log_for_path(workdir, outside, None)
            .expect("log for path")
            .is_empty()
      );
   }

   #[test]
   fn treats_an_empty_path_as_no_history() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("add tracked");

      assert!(
         _git_log_for_path(repo.workdir(), "   ".to_string(), None)
            .expect("log")
            .is_empty()
      );
   }

   #[test]
   fn honours_the_limit() {
      let repo = TestRepo::new();
      repo.write("tracked.txt", "one");
      repo.commit("first");
      repo.write("tracked.txt", "two");
      repo.commit("second");
      repo.write("tracked.txt", "three");
      repo.commit("third");

      let absolute = format!("{}/tracked.txt", repo.workdir());
      let commits = _git_log_for_path(repo.workdir(), absolute, Some(2)).expect("log for path");

      assert_eq!(commits.len(), 2);
      assert_eq!(commits[0].message, "third");
      assert_eq!(commits[1].message, "second");
   }
}
