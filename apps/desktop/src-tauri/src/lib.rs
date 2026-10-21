// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod keyring_cmds;
mod sso;

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

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

/// Stores the session token in the OS keyring (service "eco", entry = userId).
#[tauri::command]
fn store_token(user_id: String, token: String) -> Result<(), String> {
    keyring_cmds::store_token(&user_id, &token)
}

/// Loads the persisted session token, if any.
#[tauri::command]
fn load_token() -> Result<Option<keyring_cmds::StoredToken>, String> {
    keyring_cmds::load_token()
}

/// Removes the persisted session token from the keyring (idempotent).
#[tauri::command]
fn clear_token() -> Result<(), String> {
    keyring_cmds::clear_token()
}

/// Update status reported to the UI: consults the endpoint configured in
/// tauri.conf.json (plugins.updater) and compares with the app version.
#[derive(serde::Serialize)]
pub struct UpdateStatus {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
}

/// Silent update check (Task 12): uses the tauri-plugin-updater instance,
/// which fetches the endpoint and compares the remote version. Download and
/// install are done separately by the frontend (silent, applies on restart).
#[tauri::command]
async fn check_updates(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    Ok(UpdateStatus {
        update_available: update.is_some(),
        current_version: app.package_info().version.to_string(),
        latest_version: update.map(|u| u.version),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            begin_sso_listener,
            finish_sso_listener,
            store_token,
            load_token,
            clear_token,
            check_updates
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
