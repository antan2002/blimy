use crate::secure_storage::{get_secret, remove_secret, store_secret};
use tauri::command;

/// Store the auth token using OS keychain when available.
#[command]
pub async fn store_auth_token(
   app: crate::app_runtime::AppHandle,
   token: String,
   key: String,
) -> Result<(), String> {
   store_secret(&app, &key, &token)
}

/// Get the stored auth token
#[command]
pub async fn get_auth_token(app: crate::app_runtime::AppHandle, key: String) -> Result<Option<String>, String> {
   get_secret(&app, &key)
}

/// Remove the auth token
#[command]
pub async fn remove_auth_token(app: crate::app_runtime::AppHandle, key: String) -> Result<(), String> {
   remove_secret(&app, &key)
}
