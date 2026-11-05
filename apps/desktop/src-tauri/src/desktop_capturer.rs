use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use xcap::{Monitor, Window};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: String, // "screen" or "window"
    pub subtitle: String,
    pub resolution: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
}

#[tauri::command]
pub async fn get_desktop_sources() -> Result<Vec<DesktopSource>, String> {
    tokio::task::spawn_blocking(|| {
        let mut sources = Vec::new();

        // 1. Monitores (Telas Inteiras)
        if let Ok(monitors) = Monitor::all() {
            for (idx, monitor) in monitors.into_iter().enumerate() {
                let monitor_id = monitor.id().unwrap_or(idx as u32);
                let id = format!("screen:{}", monitor_id);
                let name = monitor.name().unwrap_or_else(|_| format!("Tela {}", idx + 1));
                let width = monitor.width().unwrap_or(1920);
                let height = monitor.height().unwrap_or(1080);
                let is_primary = monitor.is_primary().unwrap_or(idx == 0);
                let subtitle = if is_primary {
                    "Monitor Desktop Primário".to_string()
                } else {
                    "Monitor Estendido".to_string()
                };

                sources.push(DesktopSource {
                    id,
                    name,
                    source_type: "screen".to_string(),
                    subtitle,
                    resolution: format!("{}x{}", width, height),
                    thumbnail: None,
                });
            }
        }

        // 2. Janelas de Aplicativos Abertos
        if let Ok(windows) = Window::all() {
            for window in windows {
                let title = window.title().unwrap_or_default().trim().to_string();
                if title.is_empty() {
                    continue;
                }

                if window.is_minimized().unwrap_or(false) {
                    continue;
                }

                let app_name = window.app_name().unwrap_or_default().trim().to_string();
                let display_name = if !title.is_empty() {
                    title
                } else if !app_name.is_empty() {
                    app_name.clone()
                } else {
                    continue;
                };

                let width = window.width().unwrap_or(0);
                let height = window.height().unwrap_or(0);

                if width < 100 || height < 100 {
                    continue;
                }

                let win_id = window.id().unwrap_or(0);
                let id = format!("window:{}", win_id);
                let subtitle = if !app_name.is_empty() {
                    app_name
                } else {
                    "Janela do Aplicativo".to_string()
                };

                sources.push(DesktopSource {
                    id,
                    name: display_name,
                    source_type: "window".to_string(),
                    subtitle,
                    resolution: format!("{}x{}", width, height),
                    thumbnail: None,
                });
            }
        }

        Ok(sources)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_desktop_source_thumbnail(source_id: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let parts: Vec<&str> = source_id.split(':').collect();
        if parts.len() != 2 {
            return Err("Identificador de fonte inválido".to_string());
        }
        let kind = parts[0];
        let id_val: u32 = parts[1]
            .parse()
            .map_err(|e| format!("ID numérico inválido: {}", e))?;

        let img = if kind == "screen" {
            let monitors = Monitor::all().map_err(|e| e.to_string())?;
            let monitor = monitors
                .into_iter()
                .find(|m| m.id().map(|id| id == id_val).unwrap_or(false))
                .ok_or_else(|| "Monitor não encontrado".to_string())?;
            monitor.capture_image().map_err(|e| e.to_string())?
        } else if kind == "window" {
            let windows = Window::all().map_err(|e| e.to_string())?;
            let window = windows
                .into_iter()
                .find(|w| w.id().map(|id| id == id_val).unwrap_or(false))
                .ok_or_else(|| "Janela não encontrada".to_string())?;
            window.capture_image().map_err(|e| e.to_string())?
        } else {
            return Err("Tipo de fonte desconhecido".to_string());
        };

        let thumb = image::imageops::thumbnail(&img, 320, 180);
        let mut buffer = Cursor::new(Vec::new());
        thumb
            .write_to(&mut buffer, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        let encoded = BASE64.encode(buffer.into_inner());
        Ok(format!("data:image/png;base64,{}", encoded))
    })
    .await
    .map_err(|e| e.to_string())?
}
