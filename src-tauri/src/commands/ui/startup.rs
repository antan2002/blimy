#[cfg(debug_assertions)]
use crate::app_runtime::BlimyRuntime;
#[cfg(debug_assertions)]
use std::time::Duration;
use std::{
   sync::atomic::{AtomicBool, Ordering},
   time::Instant,
};
#[cfg(debug_assertions)]
use tauri::Manager;
use tauri::State;

pub struct StartupTiming {
   started_at: Instant,
   renderer_entered: AtomicBool,
}

impl StartupTiming {
   pub fn new() -> Self {
      Self {
         started_at: Instant::now(),
         renderer_entered: AtomicBool::new(false),
      }
   }

   pub fn record(&self, milestone: &str) {
      log::info!(
         "[startup] {milestone} elapsedMs={}",
         self.started_at.elapsed().as_millis()
      );
      if is_allowed_renderer_milestone(milestone) {
         self.renderer_entered.store(true, Ordering::Relaxed);
      }
   }

   pub fn renderer_entered(&self) -> bool {
      self.renderer_entered.load(Ordering::Relaxed)
   }
}

fn is_allowed_renderer_milestone(milestone: &str) -> bool {
   matches!(
      milestone,
      "frontend:entry"
         | "react:scheduled"
         | "app:first-frame"
         | "workbench:first-frame"
         | "bootstrap:complete"
         | "workspace:ready"
         | "workspace:error"
         | "editor:first-ready"
   )
}

#[tauri::command]
pub fn record_startup_milestone(
   timing: State<'_, StartupTiming>,
   milestone: String,
) -> Result<(), String> {
   if !is_allowed_renderer_milestone(&milestone) {
      return Err("Unknown startup milestone".to_string());
   }

   timing.record(&milestone);
   Ok(())
}

/// The dev window opens as soon as the dev server port accepts TCP, which can
/// precede the module graph being servable while Vite re-optimizes deps. If
/// the renderer never reaches `frontend:entry`, force a navigation retry so a
/// stuck first load recovers instead of leaving a black window.
#[cfg(debug_assertions)]
pub fn spawn_renderer_watchdog(app: tauri::AppHandle<BlimyRuntime>) {
   const RETRY_DELAYS_SECS: [u64; 3] = [15, 20, 30];

   std::thread::spawn(move || {
      for delay in RETRY_DELAYS_SECS {
         std::thread::sleep(Duration::from_secs(delay));
         if app.state::<StartupTiming>().renderer_entered() {
            return;
         }
         let Some(window) = app.get_webview_window("main") else {
            return;
         };
         let Ok(url) = window.url() else {
            return;
         };
         log::warn!("[startup] renderer watchdog: no frontend activity, reloading {url}");
         if let Err(error) = window.navigate(url) {
            log::error!("[startup] renderer watchdog reload failed: {error}");
            return;
         }
      }
      if !app.state::<StartupTiming>().renderer_entered() {
         log::error!(
            "[startup] renderer watchdog: frontend never started; the dev server may still be \
             bundling dependencies"
         );
      }
   });
}

#[cfg(test)]
mod tests {
   use super::*;

   #[test]
   fn accepts_only_known_renderer_milestones() {
      assert!(is_allowed_renderer_milestone("workbench:first-frame"));
      assert!(is_allowed_renderer_milestone("editor:first-ready"));
      assert!(!is_allowed_renderer_milestone("arbitrary-event"));
   }
}
