use blimy_browser_automation::{BrowserActionInput, BrowserResult, execute_browser_action_async};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, command};

#[command]
pub async fn execute_browser_action(
   app_handle: AppHandle,
   url: String,
   action: Option<String>,
   selector: Option<String>,
   text: Option<String>,
) -> Result<BrowserResult, String> {
   let app_dir = app_handle
      .path()
      .app_data_dir()
      .unwrap_or_else(|_| PathBuf::from("."));
   let screenshot_dir = app_dir.join("browser-screenshots");
   let screenshot_dir_str = screenshot_dir.to_string_lossy().to_string();

   let input = BrowserActionInput {
      url,
      action,
      selector,
      text,
   };

   execute_browser_action_async(input, &screenshot_dir_str)
      .await
      .map_err(|e| e.to_string())
}
