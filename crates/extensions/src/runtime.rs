#[cfg(feature = "linux")]
pub type BlimyAppHandle = tauri::AppHandle<tauri::Cef>;

#[cfg(not(feature = "linux"))]
pub type BlimyAppHandle = tauri::AppHandle<tauri::Wry>;
