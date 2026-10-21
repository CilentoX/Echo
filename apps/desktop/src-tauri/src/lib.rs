// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod sso;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Opens the one-shot loopback listener for the SSO callback; returns its port.
#[tauri::command]
async fn begin_sso_listener() -> Result<u16, String> {
    sso::begin_sso_listener().await
}

/// Waits for the `loginToken` captured by the listener on `port` (5 min timeout).
#[tauri::command]
async fn finish_sso_listener(port: u16) -> Result<String, String> {
    sso::finish_sso_listener(port).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            begin_sso_listener,
            finish_sso_listener
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
