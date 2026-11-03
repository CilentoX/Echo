// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod keyring_cmds;
mod sso;

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

/// Ajusta o tamanho da janela para o modo splash do updater (312x380).
#[tauri::command]
async fn set_splash_mode(window: tauri::Window) -> Result<(), String> {
    let _ = window.set_decorations(false);
    let _ = window.set_resizable(false);
    let _ = window.set_min_size(Some(tauri::LogicalSize::new(312.0, 380.0)));
    let _ = window.set_size(tauri::LogicalSize::new(312.0, 380.0));
    let _ = window.center();
    Ok(())
}

/// Ajusta o tamanho da janela para o modo aplicativo principal (após splash/updater).
#[tauri::command]
async fn set_main_mode(window: tauri::Window) -> Result<(), String> {
    let _ = window.set_resizable(true);
    let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
    let _ = window.set_size(tauri::LogicalSize::new(1200.0, 800.0));
    let _ = window.set_decorations(true);
    let _ = window.center();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            begin_sso_listener,
            finish_sso_listener,
            store_token,
            load_token,
            clear_token,
            set_splash_mode,
            set_main_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
