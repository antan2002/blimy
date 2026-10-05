#[cfg(feature = "linux")]
pub type BlimyRuntime = tauri::Cef;

#[cfg(not(feature = "linux"))]
pub type BlimyRuntime = tauri::Wry;

pub type AppHandle = tauri::AppHandle<BlimyRuntime>;
