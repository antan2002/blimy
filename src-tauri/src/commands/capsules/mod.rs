use blimy_capsules::{
   Capsule, CapsuleContextItem, CapsuleEvidence, CapsuleRepository, CapsuleRun, CapsuleWithChildren,
};
use std::path::PathBuf;
use tauri::{Manager, command};

fn capsule_db_path(app: &crate::app_runtime::AppHandle) -> Result<PathBuf, String> {
   let app_data_dir = app
      .path()
      .app_data_dir()
      .map_err(|e| format!("Failed to get app data dir: {}", e))?;
   Ok(app_data_dir.join("capsules.db"))
}

fn repository(app: &crate::app_runtime::AppHandle) -> Result<CapsuleRepository, String> {
   Ok(CapsuleRepository::new(capsule_db_path(app)?))
}

#[command]
pub async fn init_capsule_database(app: crate::app_runtime::AppHandle) -> Result<(), String> {
   repository(&app)?.initialize()
}

#[command]
pub async fn save_capsule(
   app: crate::app_runtime::AppHandle,
   capsule: Capsule,
) -> Result<i64, String> {
   repository(&app)?.save_capsule(&capsule)
}

#[command]
pub async fn load_capsule(
   app: crate::app_runtime::AppHandle,
   capsule_id: String,
) -> Result<CapsuleWithChildren, String> {
   repository(&app)?.load_capsule(&capsule_id)
}

#[command]
pub async fn list_capsules(
   app: crate::app_runtime::AppHandle,
   project_id: String,
) -> Result<Vec<Capsule>, String> {
   repository(&app)?.list_capsules(&project_id)
}

#[command]
pub async fn add_capsule_context(
   app: crate::app_runtime::AppHandle,
   item: CapsuleContextItem,
) -> Result<(), String> {
   repository(&app)?.add_context(&item)
}

/// Returns whether the run's log was trimmed to fit the row.
#[command]
pub async fn add_capsule_run(
   app: crate::app_runtime::AppHandle,
   run: CapsuleRun,
) -> Result<bool, String> {
   repository(&app)?.add_run(&run)
}

#[command]
pub async fn add_capsule_evidence(
   app: crate::app_runtime::AppHandle,
   evidence: CapsuleEvidence,
) -> Result<(), String> {
   repository(&app)?.add_evidence(&evidence)
}

#[command]
pub async fn delete_capsule(
   app: crate::app_runtime::AppHandle,
   capsule_id: String,
) -> Result<(), String> {
   repository(&app)?.delete_capsule(&capsule_id)
}
