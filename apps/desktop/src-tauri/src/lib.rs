// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod config_store;
mod desktop_capturer;
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

#[cfg(target_os = "windows")]
fn setup_webview2_flags() {
    let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();

    // Detecta o idioma nativo do sistema para casar o monitor sem abrir o diálogo nativo do Chromium
    unsafe extern "system" {
        fn GetUserDefaultUILanguage() -> u16;
    }
    let lang_id = unsafe { GetUserDefaultUILanguage() } & 0x03ff;
    let auto_source = match lang_id {
        0x16 => "Tela",       // Português (Brasil / Portugal) -> Casa "Tela Inteira" / "Tela 1"
        0x0a => "Pantalla",   // Espanhol
        0x07 => "Bildschirm", // Alemão
        0x0c => "Écran",      // Francês
        0x10 => "Schermo",    // Italiano
        _ => "Screen",        // Inglês (0x09) e fallback padrão -> Casa "Entire Screen" / "Screen 1"
    };

    let echo_args = format!(
        "--disable-infobars --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,PreloadMediaEngagementData --enable-usermedia-screen-capturing --use-fake-ui-for-media-stream --auto-select-desktop-capture-source=\"{}\"",
        auto_source
    );
    let combined = if current_args.is_empty() {
        echo_args
    } else {
        format!("{} {}", current_args, echo_args)
    };
    // Configura flags nativas do WebView2 antes da inicialização do runtime Edge
    unsafe {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
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

/// Starts a loopback HTTP listener on a random available port for the Spotify PKCE flow.
/// Returns the port and the code verifier (to include in the auth URL).
#[tauri::command]
async fn begin_spotify_sso_listener() -> Result<(u16, String), String> {
    sso::begin_spotify_sso_listener().await
}

/// Waits for the `code` captured by the Spotify PKCE listener on `port` (5 min timeout).
#[tauri::command]
async fn finish_spotify_listener(port: u16) -> Result<String, String> {
    sso::finish_spotify_listener(port).await
}

/// Stores the full session in the OS keyring (service "eco", entry = userId).
#[tauri::command]
fn store_token(
    user_id: String,
    token: String,
    refresh_token: Option<String>,
    device_id: Option<String>,
    api_base_url: Option<String>,
    expires_at: Option<u64>,
) -> Result<(), String> {
    keyring_cmds::store_token(
        &user_id,
        &token,
        refresh_token.as_deref(),
        device_id.as_deref(),
        api_base_url.as_deref(),
        expires_at,
    )
}

/// Loads the persisted session, if any.
#[tauri::command]
fn load_token() -> Result<Option<keyring_cmds::StoredToken>, String> {
    keyring_cmds::load_token()
}

/// Removes the persisted session from the keyring (idempotent).
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

static IS_CLOSING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Chamado pelo frontend assim que o cleanup assíncrono (WebRTC leave, sync stop) for concluído.
/// Encerra o processo Tauri de forma limpa e imediata.
#[tauri::command]
fn ack_close_and_exit(app: tauri::AppHandle) -> Result<(), String> {
    let _ = config_store::flush_all();
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    register_custom_scheme();

    #[cfg(target_os = "windows")]
    setup_webview2_flags();

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
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if IS_CLOSING.swap(true, std::sync::atomic::Ordering::SeqCst) {
                    api.prevent_close();
                    window.app_handle().exit(0);
                    return;
                }
                api.prevent_close();

                // Notifica o frontend para fechar WebRTC e parar syncs
                let _ = window.emit("echo://close-requested", ());

                let app_handle = window.app_handle().clone();
                std::thread::spawn(move || {
                    let _ = config_store::flush_all();

                    // Timeout defensivo de 400ms para encerramento gracioso do processo;
                    // se o frontend chamar ack_close_and_exit antes, o app já sai imediatamente.
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    app_handle.exit(0);
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            ack_close_and_exit,
            begin_sso_listener,
            finish_sso_listener,
            begin_spotify_sso_listener,
            finish_spotify_listener,
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
            config_store::get_app_storage_info,
            desktop_capturer::get_desktop_sources,
            desktop_capturer::get_desktop_source_thumbnail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}