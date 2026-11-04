// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod config_store;
mod keyring_cmds;
mod sso;

use tauri::{Emitter, Manager};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Retorna o código de convite recebido via CLI arguments no primeiro boot (se houver).
#[tauri::command]
fn get_launch_invite_code() -> Option<String> {
    for arg in std::env::args() {
        if let Some(pos) = arg.find("echo://invite/") {
            let code = &arg[pos + "echo://invite/".len()..];
            let clean = code.trim_matches(|c: char| c == '/' || c == '"' || c == '\'');
            if !clean.is_empty() {
                return Some(clean.to_string());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn register_custom_scheme() {
    if let Ok(exe) = std::env::current_exe() {
        let exe_path = exe.to_string_lossy();
        let cmd = format!("\"{}\" \"%1\"", exe_path);
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\echo",
                "/f",
                "/ve",
                "/t",
                "REG_SZ",
                "/d",
                "URL:Echo Protocol",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\echo",
                "/f",
                "/v",
                "URL Protocol",
                "/t",
                "REG_SZ",
                "/d",
                "",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Classes\\echo\\shell\\open\\command",
                "/f",
                "/ve",
                "/t",
                "REG_SZ",
                "/d",
                &cmd,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
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
    #[cfg(target_os = "windows")]
    register_custom_scheme();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Se outra instância for iniciada (ex: link echo://invite/ clicado no navegador),
            // traz a janela já aberta para frente sem abrir uma janela fantasma
            for (_, window) in app.webview_windows() {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            let _ = app.emit("single-instance", argv);
        }))
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
            set_main_mode,
            get_launch_invite_code,
            config_store::read_app_config,
            config_store::write_app_config,
            config_store::update_app_config_key,
            config_store::read_app_cache,
            config_store::write_app_cache,
            config_store::update_app_cache_key,
            config_store::clear_app_cache,
            config_store::get_app_storage_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
